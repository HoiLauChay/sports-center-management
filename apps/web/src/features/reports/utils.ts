import type { ChartSeries } from '~/components/charts/BarChart';
import { ORDER_ITEM_TYPE_LABEL, ORDER_ITEM_TYPES } from '~/features/checkout/types';
import { formatDate } from '~/lib/format';
import { addDays, DATE_FORMAT, dayOfWeek, nowVN, parseDate, todayVN } from '~/lib/time';
import type { Granularity, MembersReport, ReportDateQuery, ReportExportFormat, ReportRange, ReportType } from './types';

const percentFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

export function defaultRange(): ReportRange {
  return {
    from: nowVN().subtract(29, 'day').format(DATE_FORMAT),
    to: nowVN().format(DATE_FORMAT),
    granularity: 'day',
  };
}

export function toDateQuery(range: Pick<ReportRange, 'from' | 'to'>): ReportDateQuery {
  return { from: range.from, to: range.to };
}

export function periodLabel(period: string, granularity: Granularity) {
  if (granularity === 'month') return parseDate(`${period}-01`).format('MM/YYYY');
  const date = parseDate(period).format('DD/MM');
  return granularity === 'week' ? `Tuần ${date}` : date;
}

export function periodText(period: string, granularity: Granularity) {
  if (granularity === 'month') return `Tháng ${parseDate(`${period}-01`).format('MM/YYYY')}`;
  if (granularity === 'week') return `Tuần từ ${formatDate(period)}`;
  return formatDate(period);
}

export function periodBucketOf(date: string, granularity: Granularity): string {
  if (granularity === 'month') return date.slice(0, 7);
  if (granularity === 'week') return addDays(date, -((dayOfWeek(date) + 6) % 7));
  return date;
}

export interface NewMemberBucket {
  period: string;
  count: number;
  cumulative: number;
}

/** Aggregates daily `newByPeriod` entries into day / week / month buckets with a running cumulative count. */
export function groupNewMembersByPeriod(
  items: MembersReport['newByPeriod'],
  granularity: Granularity,
): NewMemberBucket[] {
  const grouped = new Map<string, number>();
  for (const item of items) {
    const key = periodBucketOf(item.period, granularity);
    grouped.set(key, (grouped.get(key) ?? 0) + item.count);
  }
  let cumulative = 0;
  return [...grouped.entries()].map(([period, count]) => {
    cumulative += count;
    return { period, count, cumulative };
  });
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}

export function formatCount(value: number): string {
  return integerFormatter.format(value);
}

export function reportExportFileName(
  report: ReportType,
  format: ReportExportFormat,
  range: Pick<ReportRange, 'from' | 'to'>,
): string {
  const suffix = report === 'overview' ? todayVN() : `${range.from}_${range.to}`;
  return `bao-cao-${report}-${suffix}.${format}`;
}

export function saveReportBlob(data: Blob, fileName: string, format: ReportExportFormat) {
  const mimeType =
    format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
