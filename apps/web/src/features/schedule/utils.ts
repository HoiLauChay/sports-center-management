import type { CoachScheduleItem, MemberScheduleItem, PersonalScheduleQuery } from '@sports-center/shared';
import dayjs from 'dayjs';
import { DATE_FORMAT, addDays, dayOfWeek, isPast, nowVN, parseDate, toMinutes } from '~/lib/time';
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

export const KIND_STYLE: Record<
  ScheduleKind,
  { label: string; chip: string; dot: string; text: string; block: string; blockTime: string }
> = {
  BOOKING: {
    label: 'Đặt sân / phòng',
    chip: 'border-l-sc-accent bg-sc-accent-soft',
    dot: 'bg-sc-accent',
    text: 'text-sc-accent',
    block: 'bg-sc-accent text-white',
    blockTime: 'text-white/80',
  },
  CLASS_SESSION: {
    label: 'Buổi học',
    chip: 'border-l-sc-primary bg-sc-primary-soft',
    dot: 'bg-sc-primary',
    text: 'text-sc-primary',
    block: 'bg-sc-primary text-white',
    blockTime: 'text-sc-lime',
  },
};

const MIN_HOURS = 6;

/** Whole hours the week grid spans: an hour either side of the events shown, at least six hours (08:00–20:00 when empty). */
export function hourRange(events: CalendarEvent[]) {
  if (events.length === 0) return { start: 8, end: 20 };
  let start = Math.min(...events.map((event) => Math.floor(toMinutes(event.startTime) / 60))) - 1;
  let end = Math.max(...events.map((event) => Math.ceil(toMinutes(event.endTime) / 60))) + 1;
  while (end - start < MIN_HOURS) {
    if (start > 0) start -= 1;
    if (end - start < MIN_HOURS && end < 24) end += 1;
  }
  return { start: Math.max(0, start), end: Math.min(24, end) };
}

export interface TimeRow {
  from: number;
  to: number;
  top: number;
  height: number;
  /** A run of empty hours folded into a thin band. */
  folded: boolean;
}

/**
 * Rows of the week grid from `start` to `end` (hours): an hour with any event gets `hourHeight`,
 * while two or more empty hours in a row fold into one `foldHeight` band. The hour holding `keepOpen`
 * (a minute of the day, e.g. now) never folds.
 */
export function timeRows(
  events: CalendarEvent[],
  range: { start: number; end: number },
  hourHeight: number,
  foldHeight: number,
  keepOpen?: number,
) {
  const busy = (hour: number) =>
    (keepOpen !== undefined && Math.floor(keepOpen / 60) === hour) ||
    events.some((event) => toMinutes(event.startTime) < (hour + 1) * 60 && toMinutes(event.endTime) > hour * 60);
  const rows: TimeRow[] = [];
  let top = 0;
  let hour = range.start;
  while (hour < range.end) {
    let run = hour;
    while (run < range.end && !busy(run)) run += 1;
    if (run - hour >= 2) {
      rows.push({ from: hour * 60, to: run * 60, top, height: foldHeight, folded: true });
      top += foldHeight;
      hour = run;
      continue;
    }
    rows.push({ from: hour * 60, to: (hour + 1) * 60, top, height: hourHeight, folded: false });
    top += hourHeight;
    hour += 1;
  }
  return { rows, height: top };
}

/** Where a minute of the day sits on the grid built by `timeRows`, or null outside it. */
export function yOf(rows: TimeRow[], minutes: number) {
  const row = rows.find((item) => minutes >= item.from && minutes <= item.to);
  if (!row) return null;
  return row.top + ((minutes - row.from) / (row.to - row.from)) * row.height;
}

/** Side-by-side lanes for one day's events (sorted by start), so overlapping ones share the column width. */
export function layoutDay(events: CalendarEvent[]) {
  const placed: { event: CalendarEvent; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const close = () => {
    for (const item of cluster) item.lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
  };
  for (const event of events) {
    const start = toMinutes(event.startTime);
    const end = toMinutes(event.endTime);
    if (start >= clusterEnd) close();
    clusterEnd = Math.max(clusterEnd, end);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    const item = { event, lane, lanes: 1 };
    cluster.push(item);
    placed.push(item);
  }
  close();
  return placed;
}

/** The first event not cancelled and not over yet, earliest first. */
export function nextUp(events: CalendarEvent[]) {
  return [...events]
    .filter((event) => !event.cancelled && !isPast(event.date, event.endTime))
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0];
}

/** "2 ngày 3 giờ", "1 giờ 20 phút", "15 phút" until the event starts, or null once it has. */
export function countdown(event: CalendarEvent) {
  const now = dayjs(nowVN().format(`${DATE_FORMAT} HH:mm`));
  const total = dayjs(`${event.date} ${event.startTime}`).diff(now, 'minute');
  if (total <= 0) return null;
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days} ngày${hours ? ` ${hours} giờ` : ''}`;
  if (hours > 0) return `${hours} giờ${minutes ? ` ${minutes} phút` : ''}`;
  return `${minutes} phút`;
}

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
    substitute: entry.isSubstitute,
    attendance:
      entry.status === 'SCHEDULED' && isPast(entry.date, entry.endTime)
        ? { ...entry.attendance, complete: entry.attendance.marked >= entry.attendance.total }
        : undefined,
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
