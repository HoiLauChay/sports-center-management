import type { Maintenance } from '@sports-center/shared';
import dayjs from 'dayjs';
import { VN_TIMEZONE } from '~/lib/format';
import { nowVN } from '~/lib/time';
import type { MaintenancePhase } from './types';

export const MINUTE_FORMAT = 'YYYY-MM-DD HH:mm';

/** An ISO timestamp as business-timezone `YYYY-MM-DD HH:mm`, which compares correctly as a string. */
export const localOf = (iso: string) => dayjs(iso).tz(VN_TIMEZONE).format(MINUTE_FORMAT);

/** Not started yet, running now, or over. Only a maintenance that has not started can be removed (BR_2.19). */
export function phaseOf(item: Pick<Maintenance, 'startAt' | 'endAt'>): MaintenancePhase {
  const now = nowVN().format(MINUTE_FORMAT);
  if (localOf(item.endAt) <= now) return 'DONE';
  return localOf(item.startAt) <= now ? 'ONGOING' : 'PLANNED';
}
