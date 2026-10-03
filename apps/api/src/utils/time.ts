const CENTER_TIMEZONE = 'Asia/Ho_Chi_Minh';
const CENTER_UTC_OFFSET_MINUTES = 7 * 60;
const MINUTE = 60 * 1000;

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CENTER_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface Interval {
  start: number;
  end: number;
}

export const todayInCenter = (now = new Date()) => dateFormatter.format(now);

export const parseTime = (time: string) => {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const toCenterDateTime = (date: string, minutes: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + (minutes - CENTER_UTC_OFFSET_MINUTES) * MINUTE);

export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

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

export const minutesInCenter = (now = new Date()) =>
  (now.getUTCHours() * 60 + now.getUTCMinutes() + CENTER_UTC_OFFSET_MINUTES) % (24 * 60);

export const fromDbTime = (time: Date) => time.getUTCHours() * 60 + time.getUTCMinutes();

export const toDbTime = (minutes: number) => new Date(minutes * MINUTE);

export const formatTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const centerDateTimeFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: CENTER_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const part = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
  parts.find((item) => item.type === type)?.value ?? '';

export const formatCenterDate = (value: string | Date) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
  const parts = centerDateTimeFormatter.formatToParts(new Date(value));
  return `${part(parts, 'day')}/${part(parts, 'month')}/${part(parts, 'year')}`;
};

export const formatCenterDateTime = (value: string | Date) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatCenterDate(value);
  const parts = centerDateTimeFormatter.formatToParts(new Date(value));
  return `${formatCenterDate(value)} ${part(parts, 'hour')}:${part(parts, 'minute')}`;
};
