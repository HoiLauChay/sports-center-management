import type { AppNotification, Role } from '@sports-center/shared';
import type { NavigateOptions } from '@tanstack/react-router';

type Target = (id: string, role: Role) => NavigateOptions | undefined;

const STAFF_SUPPORT: Partial<Record<Role, NavigateOptions>> = {
  MEMBER: { to: '/support' },
  RECEPTIONIST: { to: '/reception/support' },
  MANAGER: { to: '/admin/support' },
};

const TARGETS: Partial<Record<string, Target>> = {
  INVOICE: (invoiceId) => ({ to: '/invoices/$invoiceId', params: { invoiceId } }),
  ORDER: (orderId) => ({ to: '/orders/$orderId', params: { orderId } }),
  BOOKING: () => ({ to: '/bookings' }),
  CLASS: (classId, role) =>
    role === 'MANAGER'
      ? { to: '/admin/classes/$classId', params: { classId } }
      : role === 'COACH'
        ? { to: '/coach/classes/$classId', params: { classId } }
        : { to: '/classes/$classId', params: { classId } },
  OPEN_CLASS: () => ({ to: '/coach/open-classes' }),
  SESSION: (sessionId) => ({ to: '/coach/sessions/$sessionId', params: { sessionId } }),
  SUPPORT_REQUEST: (_, role) => STAFF_SUPPORT[role],
  COACH_SPECIALIZATION: (_, role) =>
    role === 'MANAGER' ? { to: '/admin/specializations' } : { to: '/coach/specializations' },
  MAINTENANCE: (_, role) => (role === 'MANAGER' ? { to: '/admin/maintenances' } : { to: '/reception/bookings' }),
  BANK_TRANSACTION: () => ({ to: '/admin/bank-transactions' }),
};

/** Where a notification leads for the viewer's current role; staff and members see the same reference on different pages. */
export function notificationTarget({ referenceType, referenceId }: AppNotification, role: Role) {
  if (!referenceType || !referenceId) return undefined;
  return TARGETS[referenceType]?.(referenceId, role);
}
