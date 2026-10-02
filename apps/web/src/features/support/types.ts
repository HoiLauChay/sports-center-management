import type { Person } from '@sports-center/shared';

export const SUPPORT_CATEGORIES = ['ACCOUNT', 'MEMBERSHIP', 'BOOKING', 'CLASS', 'PAYMENT', 'OTHER'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

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

export interface SupportRequest {
  id: string;
  account: Person;
  category: SupportCategory;
  subject: string;
  description: string;
  status: SupportStatus;
  resolutionNote: string | null;
  handledBy: Person | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupportBody {
  category: SupportCategory;
  subject: string;
  description: string;
}

export interface UpdateSupportBody {
  status?: Exclude<SupportStatus, 'OPEN'>;
  resolutionNote?: string;
}

export interface ListSupportQuery {
  page: number;
  limit: number;
  status?: SupportStatus;
  category?: SupportCategory;
  q?: string;
}

/** The only status a request may move to next (OPEN → IN_PROGRESS → RESOLVED → CLOSED). */
export const NEXT_SUPPORT_STATUS: Record<SupportStatus, Exclude<SupportStatus, 'OPEN'> | null> = {
  OPEN: 'IN_PROGRESS',
  IN_PROGRESS: 'RESOLVED',
  RESOLVED: 'CLOSED',
  CLOSED: null,
};
