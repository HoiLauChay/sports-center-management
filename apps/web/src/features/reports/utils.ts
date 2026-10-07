import type { ChartSeries } from '~/components/charts/BarChart';
import { ORDER_ITEM_TYPES, ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
import { DATE_FORMAT, nowVN, parseDate } from '~/lib/time';
import type { Granularity, ReportRange } from './types';

export function defaultRange(): ReportRange {
  return {
    from: nowVN().subtract(29, 'day').format(DATE_FORMAT),
    to: nowVN().format(DATE_FORMAT),
    granularity: 'day',
  };
}

export function periodLabel(period: string, granularity: Granularity) {
  if (granularity === 'month') return parseDate(`${period}-01`).format('MM/YYYY');
  const date = parseDate(period).format('DD/MM');
  return granularity === 'week' ? `Tuần ${date}` : date;
}

const TYPE_COLOR = {
  MEMBERSHIP: '#9333ea',
  FACILITY_BOOKING: '#0f4d34',
  FACILITY_PACKAGE: '#06b6d4',
  COURSE_ENROLLMENT: '#c94a1e',
} as const;
export const REVENUE_SERIES: ChartSeries[] = ORDER_ITEM_TYPES.map((type) => ({
  key: type,
  label: ORDER_ITEM_TYPE_LABEL[type],
  color: TYPE_COLOR[type],
}));
