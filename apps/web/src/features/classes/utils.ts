import { DAY_SHORT, WEEK_ORDER } from '~/lib/time';
import type { WeeklySlot } from './types';

export function weeklyText(schedule: WeeklySlot[]) {
  const first = schedule[0];
  if (!first) return '—';
  const days = WEEK_ORDER.filter((day) => schedule.some((slot) => slot.dayOfWeek === day))
    .map((day) => DAY_SHORT[day])
    .join('/');
  return `${days} · ${first.startTime}–${first.endTime}`;
}
