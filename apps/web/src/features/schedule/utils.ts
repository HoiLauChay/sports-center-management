import type { CoachScheduleItem, MemberScheduleItem, PersonalScheduleQuery } from '@sports-center/shared';
import { DATE_FORMAT, addDays, dayOfWeek, parseDate } from '~/lib/time';
import type { CalendarEvent, CalendarView, ScheduleKind } from './types';

/** Monday of the week the date falls in (weeks run Monday to Sunday). */
export function weekStart(date: string) {
  return addDays(date, -((dayOfWeek(date) + 6) % 7));
}

export function weekDays(date: string) {
  const first = weekStart(date);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

/** Every date of the month grid containing `date`: whole weeks, from the Monday on or before the 1st. */
export function monthGrid(date: string) {
  const first = parseDate(date).startOf('month').format(DATE_FORMAT);
  const last = parseDate(date).endOf('month').format(DATE_FORMAT);
  const start = weekStart(first);
  const weeks = Math.ceil((parseDate(weekStart(last)).diff(parseDate(start), 'day') + 7) / 7);
  return Array.from({ length: weeks * 7 }, (_, index) => addDays(start, index));
}

export function rangeOf(view: CalendarView, anchor: string): PersonalScheduleQuery {
  const days = view === 'week' ? weekDays(anchor) : monthGrid(anchor);
  return { from: days[0]!, to: days.at(-1)! };
}

/** Moves the viewed day by a week or a month, keeping the day of month where the month has it. */
export function shiftAnchor(view: CalendarView, anchor: string, direction: -1 | 1) {
  return view === 'week'
    ? addDays(anchor, direction * 7)
    : parseDate(anchor).add(direction, 'month').format(DATE_FORMAT);
}

export function rangeTitle(view: CalendarView, anchor: string) {
  if (view === 'month') return `Tháng ${parseDate(anchor).format('MM/YYYY')}`;
  const days = weekDays(anchor);
  return `${parseDate(days[0]!).format('DD/MM')} – ${parseDate(days[6]!).format('DD/MM/YYYY')}`;
}

export const KIND_STYLE: Record<ScheduleKind, { label: string; chip: string; dot: string }> = {
  BOOKING: {
    label: 'Đặt sân / phòng',
    chip: 'border-l-sc-accent bg-sc-accent-soft',
    dot: 'bg-sc-accent',
  },
  CLASS_SESSION: {
    label: 'Buổi học',
    chip: 'border-l-sc-primary bg-sc-primary-soft',
    dot: 'bg-sc-primary',
  },
};

export function eventsOfMember(entries: MemberScheduleItem[]): CalendarEvent[] {
  return entries.map((entry) =>
    entry.kind === 'BOOKING'
      ? {
          key: `booking-${entry.id}`,
          kind: 'BOOKING',
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          title: entry.facility.name,
          subtitle: 'Đặt sân / phòng',
          cancelled: entry.status === 'CANCELLED',
          facility: entry.facility,
        }
      : {
          key: `session-${entry.id}`,
          kind: 'CLASS_SESSION',
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          title: entry.class.name,
          subtitle: entry.facility.name,
          cancelled: entry.status === 'CANCELLED',
          sessionId: entry.id,
          classId: entry.class.id,
          facility: entry.facility,
          coach: entry.class.coach?.fullName ?? null,
        },
  );
}

export function eventsOfCoach(entries: CoachScheduleItem[]): CalendarEvent[] {
  return entries.map((entry) => ({
    key: `session-${entry.id}`,
    kind: 'CLASS_SESSION',
    date: entry.date,
    startTime: entry.startTime,
    endTime: entry.endTime,
    title: entry.class.name,
    subtitle: `Buổi ${entry.sessionNumber} · ${entry.facility.name}`,
    cancelled: entry.status === 'CANCELLED',
    sessionId: entry.id,
    classId: entry.classId,
    facility: entry.facility,
  }));
}

export function groupByDate(events: CalendarEvent[]) {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  for (const list of byDate.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return byDate;
}
