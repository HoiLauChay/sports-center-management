import type { SupportCategory, SupportStatus } from '@sports-center/shared';

export { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '@sports-center/shared';
export type {
  CreateSupportBody,
  ListSupportQuery,
  SupportCategory,
  SupportRequest,
  SupportStatus,
  UpdateSupportBody,
} from '@sports-center/shared';

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  ACCOUNT: 'Tài khoản',
  MEMBERSHIP: 'Gói thành viên',
  BOOKING: 'Đặt sân',
  CLASS: 'Lớp học',
  PAYMENT: 'Thanh toán',
  OTHER: 'Khác',
};

export const SUPPORT_STATUS_TAG: Record<SupportStatus, { label: string; color?: string }> = {
  OPEN: { label: 'Mới', color: 'warning' },
  IN_PROGRESS: { label: 'Đang xử lý', color: 'processing' },
  RESOLVED: { label: 'Đã xử lý', color: 'success' },
  CLOSED: { label: 'Đã đóng' },
};

/** The only status a request may move to next (OPEN → IN_PROGRESS → RESOLVED → CLOSED). */
export const NEXT_SUPPORT_STATUS: Record<SupportStatus, Exclude<SupportStatus, 'OPEN'> | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: 'CLOSED',
  CLOSED: null,
};
