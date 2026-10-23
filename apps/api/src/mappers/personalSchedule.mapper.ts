import type {
  CoachScheduleItem,
  MemberBookingScheduleItem,
  MemberClassScheduleItem,
  MemberScheduleItem,
} from '@sports-center/shared';

import { toSessionResponse } from '~/mappers/class.mapper';
import type {
  CoachSessionRow,
  PersonalBookingRow,
  PersonalSessionRow,
} from '~/repositories/personalSchedule.repository';
import { formatDate, formatTime, fromDbTime, toCenterDateTime } from '~/utils/time';

export const toBookingScheduleItem = (row: PersonalBookingRow): MemberBookingScheduleItem => ({
  kind: 'BOOKING',
  id: row.id,
  date: formatDate(row.bookingDate),
  startTime: formatTime(fromDbTime(row.startTime)),
  endTime: formatTime(fromDbTime(row.endTime)),
  facility: row.facility,
  status: row.status,
});

export const toSessionScheduleItem = (row: PersonalSessionRow): MemberClassScheduleItem => {
  const { id, date, startTime, endTime, facility, status } = toSessionResponse(row);
  return { kind: 'CLASS_SESSION', id, date, startTime, endTime, facility, status, class: row.class };
};

export const toCoachScheduleItem = (row: CoachSessionRow): CoachScheduleItem => {
  const start = toCenterDateTime(formatDate(row.sessionDate), fromDbTime(row.startTime));
  const total = row.class.enrollments.filter(
    ({ enrolledAt, cancelledAt }) => enrolledAt <= start && (!cancelledAt || cancelledAt > start),
  ).length;
  return {
    ...toSessionResponse(row),
    class: { id: row.class.id, name: row.class.name },
    attendance: { marked: row._count.attendances, total },
    hasNote: row.noteTitle !== null,
  };
};

export const byStartTime = (a: MemberScheduleItem, b: MemberScheduleItem) =>
  a.date.localeCompare(b.date) ||
  a.startTime.localeCompare(b.startTime) ||
  a.endTime.localeCompare(b.endTime) ||
  a.kind.localeCompare(b.kind) ||
  a.id.localeCompare(b.id);
