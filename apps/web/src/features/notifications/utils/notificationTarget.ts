import type { AppNotification } from '@sports-center/shared';
import type { NavigateOptions } from '@tanstack/react-router';

const TARGETS: Partial<Record<string, (id: string) => NavigateOptions>> = {
  INVOICE: (invoiceId) => ({ to: '/invoices/$invoiceId', params: { invoiceId } }),
  ORDER: (orderId) => ({ to: '/orders/$orderId', params: { orderId } }),
  BOOKING: () => ({ to: '/bookings' }),
  CLASS: (classId) => ({ to: '/classes/$classId', params: { classId } }),
  SUPPORT_REQUEST: () => ({ to: '/support' }),
  BANK_TRANSACTION: () => ({ to: '/admin/bank-transactions' }),
};

export function notificationTarget({ referenceType, referenceId }: AppNotification) {
  if (!referenceType || !referenceId) return undefined;
  return TARGETS[referenceType]?.(referenceId);
}

const ACTION_LABEL: Partial<Record<string, string>> = {
  INVOICE: 'Xem hóa đơn',
  ORDER: 'Xem đơn',
  BOOKING: 'Xem lịch đặt',
  CLASS: 'Xem lớp',
  SUPPORT_REQUEST: 'Xem yêu cầu',
  BANK_TRANSACTION: 'Xem giao dịch',
};

export function notificationActionLabel({ referenceType, referenceId }: AppNotification) {
  return referenceType && referenceId ? ACTION_LABEL[referenceType] : undefined;
}
