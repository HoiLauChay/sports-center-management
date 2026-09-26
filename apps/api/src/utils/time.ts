export const CENTER_TIMEZONE = 'Asia/Ho_Chi_Minh';

const CENTER_UTC_OFFSET_MINUTES = 7 * 60;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CENTER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface Interval<T extends number | Date = number> {
  start: T;
  end: T;
}

export const todayInCenter = (now = new Date()) => dateFormatter.format(now);

export const toDbDate = (date: string) => new Date(`${date}T00:00:00.000Z`);

export const fromDbDate = (value: Date) => value.toISOString().slice(0, 10);

export const addDays = (date: string, days: number) => fromDbDate(new Date(toDbDate(date).getTime() + days * DAY));

export const dayOfWeek = (date: string) => toDbDate(date).getUTCDay();

export const parseTime = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const formatTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const toDbTime = (minutes: number) => new Date(minutes * MINUTE);

export const fromDbTime = (value: Date) => value.getUTCHours() * 60 + value.getUTCMinutes();

export const toCenterDateTime = (date: string, minutes: number) =>
  new Date(toDbDate(date).getTime() + (minutes - CENTER_UTC_OFFSET_MINUTES) * MINUTE);

export const overlaps = <T extends number | Date>(a: Interval<T>, b: Interval<T>) =>
  Number(a.start) < Number(b.end) && Number(b.start) < Number(a.end);

export const generateSlots = (openTime: number, closeTime: number, slotMinutes: number): Interval[] => {
  const slots: Interval[] = [];
  for (let start = openTime; start + slotMinutes <= closeTime; start += slotMinutes) {
    slots.push({ start, end: start + slotMinutes });
  }
  return slots;
};

export const isOnSlotGrid = ({ start, end }: Interval, openTime: number, closeTime: number, slotMinutes: number) =>
  start >= openTime &&
  end <= closeTime &&
  start < end &&
  (start - openTime) % slotMinutes === 0 &&
  (end - start) % slotMinutes === 0;
