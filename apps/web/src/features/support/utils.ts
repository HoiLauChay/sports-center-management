import type { OrderService, Role } from '@sports-center/shared';
import type { SupportRequest } from './types';

const ORDER_SERVICE: Partial<Record<SupportRequest['category'], OrderService>> = {
  BOOKING: 'BOOKING',
  CLASS: 'CLASS',
};

const staffBase = (role: Role) => (role === 'MANAGER' ? 'admin' : 'reception');

export const memberPage = (role: Role, memberId: string) =>
  role === 'MANAGER' ? `/admin/users/${memberId}` : `/reception/members/${memberId}`;

/** Where staff handle a request: the member's orders of that service for bookings and classes, otherwise their profile. */
export function handlingPage(role: Role, request: Pick<SupportRequest, 'category' | 'account'>) {
  const service = ORDER_SERVICE[request.category];
  if (!service) return memberPage(role, request.account.id);
  const search = new URLSearchParams({ memberId: request.account.id, service });
  return `/${staffBase(role)}/orders?${search.toString()}`;
}
