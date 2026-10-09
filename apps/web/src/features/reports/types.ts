import type { ReportGranularity } from '@sports-center/shared';

export { REPORT_GRANULARITIES as GRANULARITIES } from '@sports-center/shared';
export type {
  ReportGranularity as Granularity,
  OverviewReport,
  ReportRangeQuery as ReportRange,
  RevenueBucket,
  RevenueReport,
  WalletBucket,
  WalletReport,
} from '@sports-center/shared';

export const GRANULARITY_LABEL: Record<ReportGranularity, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };
