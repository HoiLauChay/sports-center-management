import { ERROR_CODE, type RosterEntry, type StudentProgress } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import { toSessionResponse } from '~/mappers/class.mapper';
import { toProgressReviewResponse, toTrainingPlanResponse } from '~/mappers/classTraining.mapper';
import { toEvaluationResponse } from '~/mappers/training.mapper';
import attendanceRepository from '~/repositories/attendance.repository';
import classTrainingRepository, { type TrainingClassRow } from '~/repositories/classTraining.repository';
import trainingRepository from '~/repositories/training.repository';
import { ErrorWithStatus } from '~/rules/error';
import { formatDate, fromDbTime, toCenterDateTime } from '~/utils/time';

type Actor = { id: string; role: Role };

const notFound = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message });
const forbidden = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.FORBIDDEN, code: ERROR_CODE.FORBIDDEN, message });

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
