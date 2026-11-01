import type { AccountStatus, ReportExportQuery, ReportGranularity, ReportType } from '@sports-center/shared';

export { REPORT_GRANULARITIES as GRANULARITIES, REPORT_EXPORT_FORMATS, REPORT_TYPES } from '@sports-center/shared';
export type {
  CoursesReport,
  FacilitiesReport,
  ReportGranularity as Granularity,
  MembersReport,
  OverviewReport,
  ReportDateQuery,
  ReportExportQuery,
  ReportRangeQuery as ReportRange,
  ReportType,
  RevenueBucket,
  RevenueReport,
  WalletBucket,
  WalletReport,
} from '@sports-center/shared';

export type ReportExportFormat = ReportExportQuery['format'];

export const GRANULARITY_LABEL: Record<ReportGranularity, string> = {
  day: 'Ngày',
  week: 'Tuần',
  month: 'Tháng',
};

export const REPORT_TAB_LABEL: Record<ReportType, string> = {
  overview: 'Tổng quan',
  revenue: 'Doanh thu',
  wallet: 'Dòng tiền ví',
  members: 'Hội viên',
  facilities: 'Sân & phòng',
  courses: 'Khóa & lớp học',
};

export const ACCOUNT_STATUS_REPORT_META: Record<AccountStatus, { label: string; tagColor: string; barColor: string }> =
  {
    ACTIVE: { label: 'Đang hoạt động', tagColor: 'success', barColor: '#16a34a' },
    INACTIVE: { label: 'Tạm khóa', tagColor: 'warning', barColor: '#d97706' },
    BANNED: { label: 'Đã cấm', tagColor: 'error', barColor: '#dc2626' },
  };
