import { DATE_FORMAT, nowVN } from '~/lib/time';
import type { ReportRange } from './types';

export function defaultRange(): ReportRange {
  return {
    from: nowVN().subtract(29, 'day').format(DATE_FORMAT),
    to: nowVN().format(DATE_FORMAT),
    granularity: 'day',
  };
}
