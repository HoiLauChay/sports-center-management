import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function formatVND(amount: number) {
  return vndFormatter.format(amount);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// API `Date` values (YYYY-MM-DD) are already business dates, so they must not be shifted by timezone.
export function formatDate(value: string | Date) {
  if (typeof value === 'string' && DATE_ONLY.test(value)) return dayjs(value).format('DD/MM/YYYY');
  return dayjs(value).tz(VN_TIMEZONE).format('DD/MM/YYYY');
}

export function formatDateTime(value: string | Date) {
  return dayjs(value).tz(VN_TIMEZONE).format('HH:mm DD/MM/YYYY');
}

export function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return ((parts.at(-1)?.[0] ?? '') + (parts.length > 1 ? (parts[0]?.[0] ?? '') : '')).toUpperCase();
}
