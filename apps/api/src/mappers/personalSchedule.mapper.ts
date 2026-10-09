import type {
  CoachScheduleItem,
  MemberBookingScheduleItem,
  MemberClassScheduleItem,
  MemberScheduleItem,
} from '@sports-center/shared';

import type { PersonalBookingRow, PersonalSessionRow } from '~/repositories/personalSchedule.repository';
import { formatDate, formatTime, fromDbTime } from '~/utils/time';

const times = (startTime: Date, endTime: Date) => ({
  startTime: formatTime(fromDbTime(startTime)),
  endTime: formatTime(fromDbTime(endTime)),
});

export const mapPersonalBooking = (row: PersonalBookingRow): MemberBookingScheduleItem => ({
  kind: 'BOOKING',
  id: row.id,
  date: formatDate(row.bookingDate),
  ...times(row.startTime, row.endTime),
  facility: row.facility,
  status: row.status,
});

export const mapMemberSession = (row: PersonalSessionRow): MemberClassScheduleItem => ({
  kind: 'CLASS_SESSION',
  id: row.id,
  date: formatDate(row.sessionDate),
  ...times(row.startTime, row.endTime),
  facility: row.facility,
  class: { id: row.class.id, name: row.class.name, coach: row.class.coach },
  status: row.status,
});

export const mapCoachSession = (row: PersonalSessionRow): CoachScheduleItem => ({
  id: row.id,
  classId: row.classId,
  sessionNumber: row.sessionNumber,
  date: formatDate(row.sessionDate),
  ...times(row.startTime, row.endTime),
  facility: row.facility,
  class: { id: row.class.id, name: row.class.name },
  status: row.status,
  cancelReason: row.cancelReason,
});

export const sortPersonalSchedule = (items: MemberScheduleItem[]): MemberScheduleItem[] =>
  items.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime) ||
      a.kind.localeCompare(b.kind) ||
      a.id.localeCompare(b.id),
  );
