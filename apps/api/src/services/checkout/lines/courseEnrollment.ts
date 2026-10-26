import { ERROR_CODE, type CheckoutItemInput, type CourseEnrollmentSnapshot } from '@sports-center/shared';

import classRepository, { type ClassDetailRow } from '~/repositories/class.repository';
import enrollmentRepository from '~/repositories/enrollment.repository';
import { busyInOrder, CLASH_MESSAGE, lineError } from '~/services/checkout/lines/shared';
import type { CheckoutContext, LineHandler } from '~/services/checkout/types';
import scheduleService, { type PlannedUse } from '~/services/schedule.service';
import { percentOf } from '~/utils/money';
import { formatDate, fromDbTime, toCenterDateTime, todayInCenter } from '~/utils/time';

type EnrollmentInput = Extract<CheckoutItemInput, { type: 'COURSE_ENROLLMENT' }>;

interface EnrollmentData {
  classId: string;
}

const notOpen = (row: ClassDetailRow, ctx: CheckoutContext) => {
  if (row.status !== 'OPEN') return 'Lớp chưa mở đăng ký';
  if (!row.startDate || formatDate(row.startDate) <= todayInCenter(ctx.now)) return 'Lớp đã bắt đầu';
  return null;
};

export const courseEnrollmentHandler: LineHandler<EnrollmentInput, EnrollmentData, CourseEnrollmentSnapshot> = {
  type: 'COURSE_ENROLLMENT',
  guestAllowed: false,
  needsScheduleLock: true,

  lockTargets: (input) => ({ classes: [input.classId] }),

  prepare: async (db, ctx, input) => {
    if (ctx.buyer.kind === 'GUEST') return lineError(ERROR_CODE.GUEST_NOT_ALLOWED, 'Khách vãng lai không đăng ký lớp');
    const accountId = ctx.buyer.accountId;
    const row = await classRepository.findDetail(input.classId, db);
    if (!row) return lineError(ERROR_CODE.NOT_FOUND, 'Lớp không tồn tại');
    const closed = notOpen(row, ctx);
    if (closed) return lineError(ERROR_CODE.INVALID_STATE, closed);

    const sessions = row.sessions.filter(({ status }) => status === 'SCHEDULED');
    if (!row.coach || sessions.length === 0) return lineError(ERROR_CODE.INVALID_STATE, 'Lớp chưa mở đăng ký');

    const seatsHeld = ctx.planned.filter(
      ({ type, data }) => type === 'COURSE_ENROLLMENT' && (data as EnrollmentData).classId === row.id,
    );
    const inOrder = seatsHeld.some((line) => line.accountId === accountId);
    if (inOrder || (await enrollmentRepository.hasActive(row.id, accountId, db))) {
      return lineError(ERROR_CODE.CONFLICT, 'Người mua đã đăng ký lớp này');
    }
    if (row._count.enrollments + seatsHeld.length >= row.maxStudents) {
      return lineError(ERROR_CODE.CONFLICT, 'Lớp đã đủ học viên');
    }

    const ranges = sessions.map((session) => ({
      date: formatDate(session.sessionDate),
      start: fromDbTime(session.startTime),
      end: fromDbTime(session.endTime),
    }));
    if (busyInOrder(ctx, ranges)) return lineError(ERROR_CODE.SCHEDULE_CONFLICT, CLASH_MESSAGE.MEMBER_BUSY);
    const [clash] = await scheduleService.findConflicts(db, { ranges, accountId, now: ctx.now });
    if (clash) return lineError(ERROR_CODE.SCHEDULE_CONFLICT, CLASH_MESSAGE[clash.reason]);

    const subtotal = Number(row.course.price);
    const discountPct = ctx.benefits?.current?.classDiscountPct ?? 0;
    const first = ranges[0]!;
    const last = ranges.at(-1)!;
    const uses: PlannedUse[] = sessions.map((session, index) => ({
      ...ranges[index]!,
      facilityId: session.facility.id,
      exclusive: true,
    }));

    return {
      ok: true,
      subtotal,
      membershipDiscount: percentOf(subtotal, discountPct),
      snapshot: {
        title: row.name,
        startAt: toCenterDateTime(first.date, first.start).toISOString(),
        endAt: toCenterDateTime(last.date, last.end).toISOString(),
        discountPct,
        className: row.name,
        courseName: row.course.name,
        sportName: row.course.sport.name,
        coachName: row.coach.fullName,
        facilityName: row.facility.name,
        sessions: sessions.length,
        startDate: first.date,
        endDate: last.date,
      },
      data: { classId: row.id },
      uses,
    };
  },

  verify: async (tx, ctx, { data }) => {
    const row = await classRepository.findDetail(data.classId, tx);
    const reason = row ? notOpen(row, ctx) : 'Lớp không tồn tại';
    return reason ? { code: ERROR_CODE.INVALID_STATE, message: reason } : null;
  },

  fulfill: async (tx, ctx, { data }, orderItemId) => {
    if (ctx.buyer.kind !== 'MEMBER') throw new Error('Enrollment requires a member buyer');
    const enrollment = await enrollmentRepository.create(
      { classId: data.classId, accountId: ctx.buyer.accountId, orderItemId },
      tx,
    );
    return { refId: enrollment.id };
  },
};
