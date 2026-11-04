import type { AppNotification, Role } from '@sports-center/shared';
import type { NavigateOptions } from '@tanstack/react-router';

type Target = (id: string, role: Role) => NavigateOptions | undefined;

const CLASS_PAGE: Partial<Record<Role, (classId: string) => NavigateOptions>> = {
  MEMBER: (classId) => ({ to: '/classes/$classId', params: { classId } }),
  COACH: (classId) => ({ to: '/coach/classes/$classId', params: { classId } }),
  MANAGER: (classId) => ({ to: '/admin/classes/$classId', params: { classId } }),
};

const SUPPORT_PAGE: Partial<Record<Role, NavigateOptions>> = {
  MEMBER: { to: '/support' },
  RECEPTIONIST: { to: '/reception/support' },
  MANAGER: { to: '/admin/support' },
};

const BOOKING_PAGE: Partial<Record<Role, NavigateOptions>> = {
  MEMBER: { to: '/bookings' },
  RECEPTIONIST: { to: '/reception/bookings' },
};

const SPECIALIZATION_PAGE: Partial<Record<Role, NavigateOptions>> = {
  COACH: { to: '/coach/specializations' },
  MANAGER: { to: '/admin/specializations' },
};

const TARGETS: Partial<Record<string, Target>> = {
  INVOICE: (invoiceId) => ({ to: '/invoices/$invoiceId', params: { invoiceId } }),
  ORDER: (orderId) => ({ to: '/orders/$orderId', params: { orderId } }),
  BOOKING: (_, role) => BOOKING_PAGE[role],
  CLASS: (classId, role) => CLASS_PAGE[role]?.(classId),
  OPEN_CLASS: () => ({ to: '/coach/open-classes' }),
  SUPPORT_REQUEST: (_, role) => SUPPORT_PAGE[role],
  COACH_SPECIALIZATION: (_, role) => SPECIALIZATION_PAGE[role],
  BANK_TRANSACTION: () => ({ to: '/admin/bank-transactions' }),
  MEMBERSHIP: () => ({ to: '/memberships/mine' }),
  WALLET_TRANSACTION: () => ({ to: '/wallet' }),
};

export function notificationTarget({ referenceType, referenceId }: AppNotification, role: Role) {
  if (!referenceType || !referenceId) return undefined;
  return TARGETS[referenceType]?.(referenceId, role);
}
