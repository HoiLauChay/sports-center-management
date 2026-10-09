import {
  ACCOUNT_STATUSES,
  ORDER_ITEM_TYPES,
  PAYMENT_METHODS,
  type AccountStatus,
  type CoursesReport,
  type FacilitiesReport,
  type MembersReport,
  type OrderItemType,
  type OverviewReport,
  type PaymentMethod,
  type ReportType,
  type RevenueReport,
  type WalletReport,
} from '@sports-center/shared';

export type Cell = string | number;

export interface ReportTable {
  name: string;
  columns: string[];
  rows: Cell[][];
}

export interface ReportDocument {
  title: string;
  period: string | null;
  tables: ReportTable[];
}

const TYPE_LABEL: Record<OrderItemType, string> = {
  MEMBERSHIP: 'Gói thành viên',
  FACILITY_BOOKING: 'Đặt sân',
  FACILITY_PACKAGE: 'Gói sân định kỳ',
  COURSE_ENROLLMENT: 'Đăng ký lớp',
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  WALLET: 'Ví',
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  TRANSFER: 'Chuyển khoản',
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Tạm khóa',
  BANNED: 'Cấm',
};

export const REPORT_TITLE: Record<ReportType, string> = {
  overview: 'Tổng quan',
  revenue: 'Doanh thu',
  wallet: 'Dòng tiền ví',
  members: 'Thành viên',
  facilities: 'Sân và phòng',
  courses: 'Khóa học',
};

const summary = (pairs: [string, Cell][]): ReportTable => ({
  name: 'Tổng hợp',
  columns: ['Chỉ số', 'Giá trị'],
  rows: pairs,
});

export const overviewTables = (report: OverviewReport): ReportTable[] => [
  summary([
    ['Doanh thu hôm nay (đ)', report.revenueToday],
    ['Thành viên mới hôm nay', report.newMembersToday],
    ['Lượt đặt sân hôm nay', report.bookingsToday],
    ['Lớp đang học', report.ongoingClasses],
    ['Gói thành viên đang hiệu lực', report.activeMemberships],
    ['Giao dịch ngân hàng chưa khớp', report.unmatchedBankTransactions],
  ]),
];

export const revenueTables = ({ buckets }: RevenueReport): ReportTable[] => [
  {
    name: 'Doanh thu',
    columns: ['Kỳ', 'Doanh thu (đ)', 'Hoàn tiền (đ)', 'Thực thu (đ)'],
    rows: buckets.map((bucket) => [bucket.period, bucket.revenue, bucket.refunds, bucket.net]),
  },
  {
    name: 'Theo loại dịch vụ',
    columns: ['Kỳ', ...ORDER_ITEM_TYPES.map((type) => `${TYPE_LABEL[type]} (đ)`)],
    rows: buckets.map((bucket) => [bucket.period, ...ORDER_ITEM_TYPES.map((type) => bucket.byType[type])]),
  },
  {
    name: 'Theo phương thức',
    columns: ['Kỳ', ...PAYMENT_METHODS.map((method) => `${METHOD_LABEL[method]} (đ)`)],
    rows: buckets.map((bucket) => [bucket.period, ...PAYMENT_METHODS.map((method) => bucket.byPaymentMethod[method])]),
  },
];

export const walletTables = (report: WalletReport): ReportTable[] => [
  summary([
    ['Tổng số dư ví (đ)', report.totalBalance],
    ['Giao dịch chưa khớp', report.unmatched.count],
    ['Số tiền chưa khớp (đ)', report.unmatched.amount],
  ]),
  {
    name: 'Theo kỳ',
    columns: [
      'Kỳ',
      'Nạp chuyển khoản (đ)',
      'Nạp tiền mặt (đ)',
      'Nạp thẻ (đ)',
      'Thanh toán (đ)',
      'Hoàn tiền (đ)',
      'Thay đổi (đ)',
    ],
    rows: report.buckets.map((bucket) => [
      bucket.period,
      bucket.topUpBankTransfer,
      bucket.topUpCounter.CASH,
      bucket.topUpCounter.CARD,
      bucket.payments,
      bucket.refunds,
      bucket.netChange,
    ]),
  },
];

export const membersTables = (report: MembersReport): ReportTable[] => [
  summary([
    ['Tổng thành viên', report.total],
    ...ACCOUNT_STATUSES.map((status): [string, Cell] => [STATUS_LABEL[status], report.byStatus[status]]),
    ['Gói đang hiệu lực', report.activeMemberships],
    ['Gói sắp hết hạn', report.expiringSoon],
    ['Tỷ lệ gia hạn (%)', report.renewalRate],
  ]),
  {
    name: 'Thành viên mới',
    columns: ['Ngày', 'Số thành viên mới'],
    rows: report.newByPeriod.map(({ period, count }) => [period, count]),
  },
];

export const facilitiesTables = (report: FacilitiesReport): ReportTable[] => [
  summary([['Công suất chung (%)', report.utilizationRate]]),
  {
    name: 'Theo sân',
    columns: ['Sân / phòng', 'Lượt đặt', 'Công suất (%)', 'Doanh thu (đ)'],
    rows: report.byFacility.map((row) => [row.name, row.bookings, row.occupancyPct, row.revenue]),
  },
];

export const coursesTables = (report: CoursesReport): ReportTable[] => [
  {
    name: 'Theo lớp',
    columns: ['Lớp', 'Đang học', 'Sĩ số tối đa', 'Lấp đầy (%)', 'Chuyên cần (%)'],
    rows: report.byClass.map((row) => [row.name, row.enrolled, row.max, row.fillRate, row.attendanceRate]),
  },
  {
    name: 'Huấn luyện viên',
    columns: ['Huấn luyện viên', 'Số học viên'],
    rows: report.topCoaches.map(({ coach, students }) => [coach.fullName, students]),
  },
];
