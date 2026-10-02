import dayjs, { type Dayjs } from 'dayjs';
import { VN_TIMEZONE } from './format';

export const DATE_FORMAT = 'YYYY-MM-DD';

/** Current moment in the business timezone (`Asia/Ho_Chi_Minh`). */
export function nowVN(): Dayjs {
  return dayjs().tz(VN_TIMEZONE);
}

export function todayVN(): string {
  return nowVN().format(DATE_FORMAT);
}

/** The business date (`YYYY-MM-DD`) an ISO timestamp falls on in `Asia/Ho_Chi_Minh`. */
export function vnDate(iso: string): string {
  return dayjs(iso).tz(VN_TIMEZONE).format(DATE_FORMAT);
}

/** Parses a business date (`YYYY-MM-DD`) without any timezone shifting. */
export function parseDate(date: string): Dayjs {
  return dayjs(date, DATE_FORMAT);
}

export function addDays(date: string, days: number): string {
  return parseDate(date).add(days, 'day').format(DATE_FORMAT);
}

/** Day of week as the API uses it: 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: string): number {
  return parseDate(date).day();
}

export const DAY_LABEL = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'] as const;
export const DAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
/** Monday-first display order of the API's day numbers. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function fromMinutes(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** True when `date` + `time` (business timezone) is already behind us. */
export function isPast(date: string, time: string): boolean {
  return `${date} ${time}` <= nowVN().format(`${DATE_FORMAT} HH:mm`);
}

export function formatDayLabel(date: string): string {
  const day = parseDate(date);
  return `${DAY_LABEL[day.day()]}, ${day.format('DD/MM/YYYY')}`;
}

/** Every date in `[startDate, startDate + 7 * weeks)` whose weekday is in `daysOfWeek`. */
export function recurringDates(startDate: string, daysOfWeek: number[], weeks: number): string[] {
  const dates: string[] = [];
  for (let offset = 0; offset < weeks * 7; offset += 1) {
    const date = addDays(startDate, offset);
    if (daysOfWeek.includes(dayOfWeek(date))) dates.push(date);
  }
  return dates;
}

export interface SlotRange {
  startTime: string;
  endTime: string;
}

/** The centre's fixed slot grid derived from the system settings. */
export function slotGrid(openTime: string, closeTime: string, slotMinutes: number): SlotRange[] {
  const slots: SlotRange[] = [];
  if (slotMinutes < 1) return slots;
  for (let start = toMinutes(openTime); start + slotMinutes <= toMinutes(closeTime); start += slotMinutes) {
    slots.push({ startTime: fromMinutes(start), endTime: fromMinutes(start + slotMinutes) });
  }
  return slots;
}
