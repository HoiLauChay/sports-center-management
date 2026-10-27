import {
  ERROR_CODE,
  saveTrainingPlanBodySchema,
  type ClassPlans,
  type MyClassTraining,
  type ProgressMilestone,
  type RosterEntry,
  type SaveProgressReviewBody,
  type SaveTrainingPlanBody,
  type StudentProgress,
  type TrainingPlanSuggestion,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toSessionResponse } from '~/mappers/class.mapper';
import {
  toAnnouncementResponse,
  toProgressReviewResponse,
  toTrainingPlanResponse,
} from '~/mappers/classTraining.mapper';
import { toEvaluationResponse } from '~/mappers/training.mapper';
import attendanceRepository from '~/repositories/attendance.repository';
import classTrainingRepository, { type TrainingClassRow } from '~/repositories/classTraining.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import trainingRepository from '~/repositories/training.repository';
import { ErrorWithStatus } from '~/rules/error';
import geminiClient from '~/services/ai/gemini.client';
import {
  buildPlanPrompt,
  MAX_CONTENT,
  MAX_GOALS,
  PLAN_SYSTEM_PROMPT,
  planSchema,
  type StudentContext,
} from '~/services/ai/planPrompt';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import { formatDate, fromDbTime, toCenterDateTime, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

type Actor = { id: string; role: Role };

const notFound = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });
const forbidden = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.FORBIDDEN, code: ERROR_CODE.FORBIDDEN, message });

const invalidState = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });
const notStudent = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Học viên không thuộc lớp này',
  });

const startOf = (session: TrainingClassRow['sessions'][number]) =>
  toCenterDateTime(formatDate(session.sessionDate), fromDbTime(session.startTime));

const requireStaffClass = async (actor: Actor, classId: string) => {
  const cls = await classTrainingRepository.findClass(classId);
  if (!cls) throw notFound('Không tìm thấy lớp học');
  if (actor.role !== 'MANAGER' && !(actor.role === 'COACH' && cls.coachId === actor.id)) {
    throw forbidden('Bạn chỉ xem được học viên của lớp mình phụ trách');
  }
  return cls;
};

const requireCoachOf = (actor: Actor, cls: TrainingClassRow | null) => {
  if (!cls) throw notFound('Không tìm thấy lớp học');
  if (actor.role !== 'COACH' || cls.coachId !== actor.id) {
    throw forbidden('Chỉ huấn luyện viên của lớp được thao tác');
  }
  return cls;
};

const assertRunning = (cls: TrainingClassRow) => {
  if (cls.status === 'CANCELLED' || (cls.endDate && formatDate(cls.endDate) < todayInCenter())) {
    throw invalidState('Lớp đã hủy hoặc đã kết thúc');
  }
};

/** Results sent to the AI per student: the latest ones are enough to show a trend. */
const RECENT_RESULTS = 10;

const ageOf = (dateOfBirth: Date | null) => {
  if (!dateOfBirth) return null;
  const [year, month, day] = todayInCenter().split('-').map(Number) as [number, number, number];
  const birthday = month * 100 + day < (dateOfBirth.getUTCMonth() + 1) * 100 + dateOfBirth.getUTCDate();
  return year - dateOfBirth.getUTCFullYear() - (birthday ? 1 : 0);
};

const aiInvalid = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: ERROR_CODE.UPSTREAM_UNAVAILABLE,
    message: 'AI trả về dữ liệu không hợp lệ, vui lòng thử lại',
  });

const assertMilestoneReached = (cls: TrainingClassRow, milestone: ProgressMilestone) => {
  const sessions = cls.sessions.filter(({ status }) => status === 'SCHEDULED');
  const now = new Date();
  if (milestone === 'MID') {
    const started = sessions.filter((session) => startOf(session) <= now).length;
    if (started < Math.ceil(sessions.length / 2)) throw invalidState('Lớp chưa học đến nửa khóa');
    return;
  }
  const last = sessions.at(-1);
  if (!last || formatDate(last.sessionDate) > todayInCenter()) throw invalidState('Lớp chưa đến buổi cuối');
};

class ClassTrainingService {
  roster = async (actor: Actor, classId: string): Promise<RosterEntry[]> => {
    const cls = await requireStaffClass(actor, classId);
    const [students, attendances, results, plans, reviews] = await Promise.all([
      classTrainingRepository.findStudents(classId),
      classTrainingRepository.findAttendances(classId),
      classTrainingRepository.findResults(classId),
      classTrainingRepository.findPlans(classId),
      classTrainingRepository.findReviews(classId),
    ]);
    const now = new Date();
    const started = cls.sessions.filter((session) => session.status === 'SCHEDULED' && startOf(session) <= now);
    const startedIds = new Set(started.map(({ id }) => id));

    return students.map(({ account, enrolledAt }) => {
      const own = attendances.filter((row) => row.accountId === account.id && startedIds.has(row.sessionId));
      const count = (status: string) => own.filter((row) => row.status === status).length;
      const expected = started.filter((session) => startOf(session) >= enrolledAt).length;
      const last = results
        .filter((row) => row.accountId === account.id)
        .sort((a, b) => b.session.sessionNumber - a.session.sessionNumber)[0];
      return {
        account: {
          id: account.id,
          fullName: account.fullName,
          phone: account.phone,
          dateOfBirth: account.dateOfBirth ? formatDate(account.dateOfBirth) : null,
          gender: account.gender,
        },
        enrolledAt: enrolledAt.toISOString(),
        fitnessGoals: account.memberProfile?.fitnessGoals ?? null,
        healthNotes: account.memberProfile?.healthNotes ?? null,
        emergencyContact: account.memberProfile?.emergencyContact ?? null,
        attendance: {
          present: count('PRESENT'),
          late: count('LATE'),
          absent: count('ABSENT'),
          unmarked: Math.max(expected - own.length, 0),
        },
        lastResult: last ? { sessionNumber: last.session.sessionNumber, rating: last.rating } : null,
        planUpdatedAt: plans.find((plan) => plan.accountId === account.id)?.updatedAt.toISOString() ?? null,
        reviews: reviews.filter((review) => review.accountId === account.id).map(({ milestone }) => milestone),
      };
    });
  };

  plans = async (actor: Actor, classId: string): Promise<ClassPlans> => {
    await requireStaffClass(actor, classId);
    const [plans, students] = await Promise.all([
      classTrainingRepository.findPlans(classId),
      classTrainingRepository.findStudents(classId),
    ]);
    const active = new Set(students.map(({ account }) => account.id));
    const classPlan = plans.find(({ accountId }) => accountId === null);
    return {
      classPlan: classPlan ? toTrainingPlanResponse(classPlan) : null,
      memberPlans: plans
        .filter(({ accountId }) => accountId !== null && active.has(accountId))
        .map(toTrainingPlanResponse),
    };
  };

  savePlan = async (actor: Actor, classId: string, accountId: string | null, body: SaveTrainingPlanBody) => {
    const { row, notifications } = await runTransaction(async (tx) => {
      await lockRows(tx, { classes: [classId] });
      const cls = requireCoachOf(actor, await classTrainingRepository.findClass(classId, tx));
      assertRunning(cls);
      if (accountId && !(await enrollmentRepository.hasActive(classId, accountId, tx))) throw notStudent();
      const row = await classTrainingRepository.savePlan(classId, accountId, { ...body, updatedById: actor.id }, tx);
      const notifications = accountId
        ? await notificationService.create(
            [
              {
                accountId,
                type: 'TRAINING',
                title: 'Kế hoạch tập luyện của bạn đã được cập nhật',
                message: `Mục tiêu: ${body.goals}`,
                referenceType: 'CLASS',
                referenceId: classId,
              },
            ],
            tx,
          )
        : [];
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toTrainingPlanResponse(row);
  };

  /**
   * Asks the AI for a draft plan from the class's course, progress and students' data.
   * Nothing is saved: the coach edits the draft and saves it through savePlan.
   */
  suggestPlan = async (actor: Actor, classId: string, accountId: string | null): Promise<TrainingPlanSuggestion> => {
    const cls = requireCoachOf(actor, await classTrainingRepository.findClass(classId));
    assertRunning(cls);
    const [info, students, attendances, results, plans, reviews] = await Promise.all([
      classTrainingRepository.findPlanContext(classId),
      classTrainingRepository.findStudents(classId, accountId ?? undefined),
      classTrainingRepository.findAttendances(classId),
      classTrainingRepository.findResults(classId, accountId ?? undefined),
      classTrainingRepository.findPlans(classId),
      classTrainingRepository.findReviews(classId, accountId ?? undefined),
    ]);
    if (!info) throw notFound('Không tìm thấy lớp học');
    if (accountId && students.length === 0) throw notStudent();

    const toStudent = ({ account }: (typeof students)[number]): StudentContext => {
      const own = attendances.filter((row) => row.accountId === account.id);
      const count = (status: string) => own.filter((row) => row.status === status).length;
      return {
        age: ageOf(account.dateOfBirth),
        gender: account.gender,
        fitnessGoals: account.memberProfile?.fitnessGoals ?? null,
        healthNotes: account.memberProfile?.healthNotes ?? null,
        attendance: { present: count('PRESENT'), late: count('LATE'), absent: count('ABSENT') },
        results: results
          .filter((row) => row.accountId === account.id)
          .sort((a, b) => b.session.sessionNumber - a.session.sessionNumber)
          .slice(0, RECENT_RESULTS)
          .map((row) => ({
            sessionNumber: row.session.sessionNumber,
            rating: row.rating,
            comment: row.comment,
          })),
        reviews: reviews
          .filter((review) => review.accountId === account.id)
          .map(({ milestone, technique, fitness, attitude, comment }) => ({
            milestone,
            technique,
            fitness,
            attitude,
            comment,
          })),
      };
    };
    const planOf = (owner: string | null) => {
      const plan = plans.find((row) => row.accountId === owner);
      return plan ? { goals: plan.goals, content: plan.content } : null;
    };
    const scheduled = cls.sessions.filter(({ status }) => status === 'SCHEDULED');
    const now = new Date();

    const answer = (await geminiClient.generateJson({
      system: PLAN_SYSTEM_PROMPT,
      prompt: buildPlanPrompt({
        course: {
          name: info.course.name,
          sport: info.course.sport.name,
          description: info.course.description,
          totalSessions: info.course.totalSessions,
        },
        className: info.name,
        sessionsPerWeek: Array.isArray(info.weeklySchedule) ? info.weeklySchedule.length : 0,
        sessionsDone: scheduled.filter((session) => startOf(session) <= now).length,
        sessionsTotal: scheduled.length,
        currentPlan: planOf(accountId),
        classPlan: accountId ? planOf(null) : null,
        students: students.map(toStudent),
        forStudent: accountId !== null,
      }),
      schema: planSchema,
    })) as Partial<Record<'goals' | 'content', unknown>> | null;

    const parsed = saveTrainingPlanBodySchema.safeParse({
      goals: typeof answer?.goals === 'string' ? answer.goals.trim().slice(0, MAX_GOALS) : undefined,
      content: typeof answer?.content === 'string' ? answer.content.trim().slice(0, MAX_CONTENT) : undefined,
    });
    if (!parsed.success) throw aiInvalid();
    return parsed.data;
  };

  saveReview = async (
    actor: Actor,
    params: { id: string; accountId: string; milestone: ProgressMilestone },
    body: SaveProgressReviewBody,
    ip?: string,
  ) => {
    const { id: classId, accountId, milestone } = params;
    const { row, notifications } = await runTransaction(async (tx) => {
      await lockRows(tx, { classes: [classId] });
      const cls = requireCoachOf(actor, await classTrainingRepository.findClass(classId, tx));
      if (cls.status === 'CANCELLED') throw invalidState('Lớp đã hủy');
      if (!(await enrollmentRepository.hasActive(classId, accountId, tx))) throw notStudent();
      assertMilestoneReached(cls, milestone);
      const current = await classTrainingRepository.findReview(classId, accountId, milestone, tx);
      const row = await classTrainingRepository.saveReview(
        { classId, accountId, milestone },
        { ...body, coachId: actor.id },
        tx,
      );
      await auditService.record(
        {
          accountId: actor.id,
          action: current ? 'UPDATE' : 'CREATE',
          entityType: 'PROGRESS_REVIEW',
          entityId: row.id,
          oldValues: current ?? undefined,
          newValues: row,
          ipAddress: ip,
        },
        tx,
      );
      const notifications = current
        ? []
        : await notificationService.create(
            [
              {
                accountId,
                type: 'TRAINING',
                title: milestone === 'MID' ? 'Bạn có đánh giá giữa khóa mới' : 'Bạn có đánh giá cuối khóa mới',
                message: body.comment,
                referenceType: 'CLASS',
                referenceId: classId,
                sendEmail: true,
              },
            ],
            tx,
          );
      return { row, notifications };
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return toProgressReviewResponse(row);
  };

  myTraining = async (accountId: string, classId: string): Promise<MyClassTraining> => {
    if (
      !(await classTrainingRepository.findClass(classId)) ||
      !(await enrollmentRepository.hasActive(classId, accountId))
    ) {
      throw notFound('Không tìm thấy lớp học');
    }
    const [plans, reviews, announcements] = await Promise.all([
      classTrainingRepository.findPlans(classId),
      classTrainingRepository.findReviews(classId, accountId),
      classTrainingRepository.findAnnouncements(classId),
    ]);
    const classPlan = plans.find((plan) => plan.accountId === null);
    const myPlan = plans.find((plan) => plan.accountId === accountId);
    return {
      classPlan: classPlan ? toTrainingPlanResponse(classPlan) : null,
      myPlan: myPlan ? toTrainingPlanResponse(myPlan) : null,
      reviews: reviews.map(toProgressReviewResponse),
      announcements: announcements.map(toAnnouncementResponse),
    };
  };

  student = async (actor: Actor, classId: string, accountId: string): Promise<StudentProgress> => {
    await requireStaffClass(actor, classId);
    if ((await classTrainingRepository.findStudents(classId, accountId)).length === 0) {
      throw notFound('Học viên không thuộc lớp này');
    }
    const [attendance, results, plans, reviews] = await Promise.all([
      attendanceRepository.findMine(accountId, classId),
      trainingRepository.findMemberEvaluations(accountId, classId),
      classTrainingRepository.findPlans(classId, accountId),
      classTrainingRepository.findReviews(classId, accountId),
    ]);
    return {
      attendance: attendance.map((row) => ({
        session: toSessionResponse(row),
        status: row.attendances[0]?.status ?? null,
        note: row.attendances[0]?.note ?? null,
      })),
      results: results.map(toEvaluationResponse),
      plan: plans[0] ? toTrainingPlanResponse(plans[0]) : null,
      reviews: reviews.map(toProgressReviewResponse),
    };
  };
}

export default new ClassTrainingService();
