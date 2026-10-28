import type { ProgressMilestone } from '@sports-center/shared';
import { z } from 'zod';

import classTrainingRepository from '~/repositories/classTraining.repository';
import {
  badRange,
  classIdArg,
  dateRange,
  dateRangeArgs,
  dateRangeParams,
  MAX_SCHEDULE_DAYS,
  noArgs,
  tool,
  weekdayOf,
  type Tool,
} from '~/services/ai/tools/toolkit';
import classService from '~/services/class.service';
import classTrainingService from '~/services/classTraining.service';
import personalScheduleService from '~/services/personalSchedule.service';
import { addDays, formatDate, fromDbTime, parseTime, toCenterDateTime, todayInCenter } from '~/utils/time';

const RECENT_RESULTS = 10;
const MILESTONE_LABEL: Record<ProgressMilestone, string> = { MID: 'Giữa khóa', FINAL: 'Cuối khóa' };

const coachOf = (accountId: string) => ({ id: accountId, role: 'COACH' as const });

/** Milestones whose review is due in a class: half the sessions started (MID), the last session reached (FINAL). */
const dueMilestones = async (classId: string): Promise<ProgressMilestone[]> => {
  const cls = await classTrainingRepository.findClass(classId);
  const sessions = cls?.sessions.filter(({ status }) => status === 'SCHEDULED') ?? [];
  if (!sessions.length) return [];
  const now = new Date();
  const started = sessions.filter(
    (session) => toCenterDateTime(formatDate(session.sessionDate), fromDbTime(session.startTime)) <= now,
  ).length;
  const due: ProgressMilestone[] = [];
  if (started >= Math.ceil(sessions.length / 2)) due.push('MID');
  if (formatDate(sessions.at(-1)!.sessionDate) <= todayInCenter()) due.push('FINAL');
  return due;
};

/**
 * Work the coach still owes: sessions of the last two weeks that started without full attendance or a note,
 * and students in running classes whose due review is missing. Shared by coach_todo and the overview.
 */
export const coachPendingWork = async (accountId: string) => {
  const today = todayInCenter();
  const now = new Date();
  const [schedule, classes] = await Promise.all([
    personalScheduleService.coach(accountId, { from: addDays(today, -(MAX_SCHEDULE_DAYS - 1)), to: today }),
    classService.listForCoach(accountId),
  ]);
  const sessions = schedule
    .filter((item) => item.status === 'SCHEDULED' && toCenterDateTime(item.date, parseTime(item.startTime)) <= now)
    .filter((item) => item.attendance.marked < item.attendance.total || !item.hasNote)
    .map((item) => ({
      sessionId: item.id,
      className: item.class.name,
      session: item.sessionNumber,
      date: item.date,
      weekday: weekdayOf(item.date),
      time: `${item.startTime}–${item.endTime}`,
      attendanceMarked: `${item.attendance.marked}/${item.attendance.total}`,
      hasNote: item.hasNote,
    }));

  const running = classes.filter((cls) => cls.status === 'OPEN' && cls.derivedStatus !== 'UPCOMING');
  const reviews = (
    await Promise.all(
      running.map(async (cls) => {
        const due = await dueMilestones(cls.id);
        if (!due.length) return [];
        const roster = await classTrainingService.roster(coachOf(accountId), cls.id);
        return roster.flatMap((entry) =>
          due
            .filter((milestone) => !entry.reviews.includes(milestone))
            .map((milestone) => ({
              classId: cls.id,
              className: cls.name,
              student: entry.account.fullName,
              studentId: entry.account.id,
              milestone: MILESTONE_LABEL[milestone],
            })),
        );
      }),
    )
  ).flat();
  return { sessions, reviews };
};

/** The coach's own classes and students; every query goes through the same checks as the coach's pages. */
export const COACH_TOOLS: Tool[] = [
  tool(
    {
      name: 'coach_schedule',
      description: `Lịch dạy của HLV đang hỏi trong khoảng ngày (tối đa ${MAX_SCHEDULE_DAYS} ngày, mặc định từ hôm nay đến 7 ngày tới): buổi, lớp, phòng, đã điểm danh bao nhiêu, đã có ghi chú chưa.`,
      parameters: dateRangeParams,
    },
    dateRangeArgs,
    async ({ accountId }, args) => {
      const range = dateRange(args);
      if (!range) return badRange;
      const items = await personalScheduleService.coach(accountId, range);
      return {
        ...range,
        sessions: items.map((item) => ({
          sessionId: item.id,
          className: item.class.name,
          classId: item.class.id,
          session: item.sessionNumber,
          date: item.date,
          weekday: weekdayOf(item.date),
          time: `${item.startTime}–${item.endTime}`,
          place: item.facility.name,
          status: item.status,
          substitute: item.isSubstitute,
          attendanceMarked: `${item.attendance.marked}/${item.attendance.total}`,
          hasNote: item.hasNote,
        })),
      };
    },
  ),
  tool(
    {
      name: 'coach_classes',
      description:
        'Các lớp HLV đang hỏi phụ trách: mã lớp, tên, bộ môn, trạng thái, lịch tuần, ngày bắt đầu/kết thúc, sĩ số.',
    },
    noArgs,
    async ({ accountId }) => ({
      classes: (await classService.listForCoach(accountId)).map((cls) => ({
        classId: cls.id,
        name: cls.name,
        sport: cls.course.sport.name,
        status: cls.status === 'CANCELLED' ? 'Đã hủy' : (cls.derivedStatus ?? cls.status),
        weeklySchedule: cls.weeklySchedule,
        startDate: cls.startDate,
        endDate: cls.endDate,
        enrolled: cls.enrolledCount,
        maxStudents: cls.maxStudents,
      })),
      weekdayMeaning: 'dayOfWeek: 0 Chủ nhật, 1 Thứ 2, ... 6 Thứ 7',
    }),
  ),
  tool(
    {
      name: 'class_roster',
      description:
        'Danh sách học viên một lớp của HLV: mã học viên, tên, mục tiêu, ghi chú sức khỏe, chuyên cần, kết quả gần nhất, đã có kế hoạch riêng chưa, đã có đánh giá mốc nào. Cần mã lớp từ coach_classes.',
      parameters: {
        type: 'OBJECT',
        properties: { classId: { type: 'STRING', description: 'Mã lớp (từ coach_classes)' } },
        required: ['classId'],
      },
    },
    classIdArg,
    async ({ accountId }, { classId }) => ({
      students: (await classTrainingService.roster(coachOf(accountId), classId)).map((entry) => ({
        studentId: entry.account.id,
        name: entry.account.fullName,
        fitnessGoals: entry.fitnessGoals,
        healthNotes: entry.healthNotes,
        attendance: entry.attendance,
        lastResult: entry.lastResult,
        hasOwnPlan: entry.planUpdatedAt !== null,
        reviews: entry.reviews.map((milestone) => MILESTONE_LABEL[milestone]),
      })),
      scale: 'Điểm từ 1 đến 5',
    }),
  ),
  tool(
    {
      name: 'student_progress',
      description: `Tiến độ chi tiết của một học viên trong lớp của HLV: điểm danh từng buổi, ${RECENT_RESULTS} kết quả gần nhất kèm nhận xét, kế hoạch riêng, đánh giá giữa/cuối khóa. Cần mã lớp và mã học viên từ class_roster.`,
      parameters: {
        type: 'OBJECT',
        properties: {
          classId: { type: 'STRING', description: 'Mã lớp' },
          studentId: { type: 'STRING', description: 'Mã học viên (studentId từ class_roster)' },
        },
        required: ['classId', 'studentId'],
      },
    },
    classIdArg.extend({ studentId: z.uuid('Mã học viên không hợp lệ') }),
    async ({ accountId }, { classId, studentId }) => {
      const progress = await classTrainingService.student(coachOf(accountId), classId, studentId);
      return {
        attendance: progress.attendance
          .filter(({ status }) => status)
          .map(({ session, status, note }) => ({ session: session.sessionNumber, date: session.date, status, note })),
        recentResults: progress.results.slice(0, RECENT_RESULTS).map(({ session, rating, comment }) => ({
          session: session.sessionNumber,
          date: session.date,
          rating,
          comment,
        })),
        plan: progress.plan ? { goals: progress.plan.goals, content: progress.plan.content } : null,
        reviews: progress.reviews.map(({ milestone, technique, fitness, attitude, comment }) => ({
          milestone: MILESTONE_LABEL[milestone],
          technique,
          fitness,
          attitude,
          comment,
        })),
        scale: 'Điểm từ 1 đến 5',
      };
    },
  ),
  tool(
    {
      name: 'coach_todo',
      description:
        'Việc HLV còn thiếu: buổi đã dạy trong 2 tuần qua chưa điểm danh đủ hoặc chưa có ghi chú, và học viên đến mốc mà chưa có đánh giá giữa/cuối khóa.',
    },
    noArgs,
    async ({ accountId }) => {
      const { sessions, reviews } = await coachPendingWork(accountId);
      return { pendingSessions: sessions, missingReviews: reviews };
    },
  ),
];
