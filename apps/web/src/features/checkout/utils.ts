import { formatDate } from '~/lib/format';
import { DAY_SHORT, WEEK_ORDER } from '~/lib/time';
import type { CheckoutItemInput, LineDescription, OrderItemType } from './types';

const text = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

const dateRange = (from: unknown, to: unknown) =>
  from && to ? `${formatDate(text(from))} – ${formatDate(text(to))}` : from ? formatDate(text(from)) : '';

function weekdays(value: unknown) {
  const days = Array.isArray(value) ? (value as number[]) : [];
  return WEEK_ORDER.filter((day) => days.includes(day))
    .map((day) => DAY_SHORT[day])
    .join('/');
}

/** Human readable title + detail for an order / quote line, read defensively from the frozen snapshot. */
export function describeLine(type: OrderItemType, snapshot: Record<string, unknown>): LineDescription {
  switch (type) {
    case 'FACILITY_BOOKING':
      return {
        title: text(snapshot.facilityName) || 'Đặt sân / phòng',
        detail: [
          snapshot.date ? formatDate(text(snapshot.date)) : '',
          snapshot.startTime ? `${text(snapshot.startTime)}–${text(snapshot.endTime)}` : '',
          snapshot.slots ? `${text(snapshot.slots)} slot` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'FACILITY_PACKAGE':
      return {
        title: `Gói định kỳ · ${text(snapshot.facilityName) || 'sân / phòng'}`,
        detail: [
          weekdays(snapshot.daysOfWeek),
          snapshot.startTime ? `${text(snapshot.startTime)}–${text(snapshot.endTime)}` : '',
          snapshot.weeks ? `${text(snapshot.weeks)} tuần` : '',
          snapshot.sessions ? `${text(snapshot.sessions)} buổi` : '',
          dateRange(snapshot.startDate, snapshot.endDate),
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'COURSE_ENROLLMENT':
      return {
        title: text(snapshot.className) || 'Đăng ký lớp',
        detail: [
          snapshot.coachName ? `HLV ${text(snapshot.coachName)}` : '',
          snapshot.facilityName ? text(snapshot.facilityName) : '',
          snapshot.totalSessions ? `${text(snapshot.totalSessions)} buổi` : '',
          dateRange(snapshot.startDate, snapshot.endDate),
        ]
          .filter(Boolean)
          .join(' · '),
      };
    case 'MEMBERSHIP':
      return {
        title: text(snapshot.packageName) || 'Gói thành viên',
        detail: [
          snapshot.durationDays ? `${text(snapshot.durationDays)} ngày` : '',
          dateRange(snapshot.periodStart, snapshot.periodEnd),
        ]
          .filter(Boolean)
          .join(' · '),
      };
  }
}

/** Stable identity of a selection, used to avoid adding the same service twice. */
export function selectionKey(selection: CheckoutItemInput): string {
  switch (selection.type) {
    case 'FACILITY_BOOKING':
      return `B:${selection.facilityId}:${selection.date}:${selection.startTime}:${selection.endTime}`;
    case 'FACILITY_PACKAGE':
      return `P:${selection.facilityId}:${selection.startDate}:${[...selection.daysOfWeek].sort().join(',')}:${selection.startTime}:${selection.endTime}:${selection.weeks}`;
    case 'COURSE_ENROLLMENT':
      return `C:${selection.classId}`;
    case 'MEMBERSHIP':
      return `M:${selection.packageId}`;
  }
}
