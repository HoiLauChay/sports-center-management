import type { Paginated } from '@sports-center/shared';
import { addRefundToItem, type BalanceOf } from '~/features/checkout/mocks/checkout';
import type { Actor } from '~/features/checkout/mocks/pricing';
import { canCancelEnrollment, enrollmentRefund } from '~/features/checkout/refundPolicy';
import { classesDb } from '~/features/classes/mocks/classes';
import type { Enrollment, MyEnrollment } from '~/features/classes/types';
import { commerceStore, type CommerceState, type StoredFacilityPackage } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { walletLedger } from '~/lib/mock/ledger';
import type { Booking, FacilityPackage } from '../types';

export interface ListBookingsQuery {
  page: number;
  limit: number;
  status?: Booking['status'];
  from?: string;
  to?: string;
}

const byStartDesc = (a: Booking, b: Booking) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`);

export function listMyBookings(actor: Actor, query: ListBookingsQuery): Paginated<Booking> {
  const rows = commerceStore
    .get()
    .bookings.filter((booking) => {
      if (booking.account?.id !== actor.id) return false;
      if (query.status && booking.status !== query.status) return false;
      if (query.from && booking.date < query.from) return false;
      if (query.to && booking.date > query.to) return false;
      return true;
    })
    .sort(byStartDesc);
  const start = (query.page - 1) * query.limit;
  return { items: rows.slice(start, start + query.limit), page: query.page, limit: query.limit, total: rows.length };
}

function expandPackage(state: CommerceState, stored: StoredFacilityPackage): FacilityPackage {
  return {
    id: stored.id,
    facility: stored.facility,
    startDate: stored.startDate,
    endDate: stored.endDate,
    daysOfWeek: stored.daysOfWeek,
    startTime: stored.startTime,
    endTime: stored.endTime,
    status: stored.status,
    unitPrice: stored.unitPrice,
    bookings: state.bookings
      .filter((booking) => stored.bookingIds.includes(booking.id))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export function listMyPackages(actor: Actor): FacilityPackage[] {
  const state = commerceStore.get();
  return state.packages
    .filter((entry) => entry.accountId === actor.id)
    .map((entry) => expandPackage(state, entry))
    .reverse();
}

export function listMyEnrollments(actor: Actor): MyEnrollment[] {
  return commerceStore
    .get()
    .enrollments.filter((entry) => entry.account.id === actor.id)
    .flatMap((entry) => {
      const found = classesDb.findClass(entry.class.id);
      return found ? [{ ...entry, class: found }] : [];
    })
    .reverse();
}

function assertOwner(actor: Actor, accountId: string | undefined) {
  if (actor.role === 'MEMBER' && accountId !== actor.id) throw mockErrors.notFound();
}

async function creditRefund(
  actor: Actor,
  accountId: string | undefined,
  amount: number,
  ref: { orderId: string; orderItemId: string; description: string },
  balanceOf: BalanceOf,
  key: string,
) {
  if (!accountId || amount <= 0) return;
  const balance = await balanceOf(accountId);
  walletLedger.record({
    accountId,
    serverBalance: balance - walletLedger.delta(accountId),
    type: 'REFUND',
    amount,
    orderId: ref.orderId,
    orderItemId: ref.orderItemId,
    createdBy: { id: actor.id, fullName: actor.fullName },
    description: ref.description,
    idempotencyKey: key,
  });
}

function orderIdOf(state: CommerceState, orderItemId: string) {
  return state.orders.find((order) => order.items.some((item) => item.id === orderItemId))?.id ?? '';
}

/**
 * Cancels a booking because the facility goes into maintenance and gives the member back everything that was paid
 * and not yet refunded; a guest paid at the counter and is not refunded (BR_2.17, BR_2.19). Returns the refund.
 */
export async function cancelBookingForMaintenance(
  actor: Actor,
  bookingId: string,
  reason: string,
  balanceOf: BalanceOf,
): Promise<number> {
  const found = commerceStore.get().bookings.find((entry) => entry.id === bookingId);
  if (!found || found.status !== 'CONFIRMED') return 0;
  const refund = found.account ? Math.max(0, found.paidAmount - found.refundedAmount) : 0;

  const orderId = commerceStore.update((state) => {
    const booking = state.bookings.find((entry) => entry.id === bookingId)!;
    booking.status = 'CANCELLED';
    booking.refundedAmount += refund;
    if (refund > 0) addRefundToItem(state, booking.orderItemId, refund);
    return orderIdOf(state, booking.orderItemId);
  });
  await creditRefund(
    actor,
    found.account?.id,
    refund,
    { orderId, orderItemId: found.orderItemId, description: reason },
    balanceOf,
    `refund:booking:${found.id}`,
  );
  return refund;
}

/**
 * Gives part of an enrollment line back to the member's wallet when a manager cancels a session or a whole class
 * (BR_2.7b, BR_2.23). Never refunds more than what was paid and not yet refunded; returns what was actually refunded.
 */
export async function refundEnrollment(
  actor: Actor,
  enrollmentId: string,
  amount: number,
  description: string,
  balanceOf: BalanceOf,
  options: { cancel?: boolean } = {},
): Promise<number> {
  const found = commerceStore.get().enrollments.find((entry) => entry.id === enrollmentId);
  if (!found) return 0;
  const refund = Math.max(0, Math.min(Math.round(amount), enrollmentRefund(found)));

  const orderId = commerceStore.update((state) => {
    const enrollment = state.enrollments.find((entry) => entry.id === enrollmentId)!;
    enrollment.refundedAmount += refund;
    if (options.cancel) enrollment.status = 'CANCELLED';
    if (refund > 0) addRefundToItem(state, enrollment.orderItemId, refund);
    return orderIdOf(state, enrollment.orderItemId);
  });
  await creditRefund(
    actor,
    found.account.id,
    refund,
    { orderId, orderItemId: found.orderItemId, description },
    balanceOf,
    `refund:enrollment:${found.id}:${found.refundedAmount + refund}`,
  );
  return refund;
}

export async function cancelEnrollment(
  actor: Actor,
  id: string,
  balanceOf: BalanceOf,
): Promise<{ enrollment: Enrollment; refund: number }> {
  const found = commerceStore.get().enrollments.find((entry) => entry.id === id);
  if (!found) throw mockErrors.notFound('Không tìm thấy đăng ký lớp');
  assertOwner(actor, found.account.id);
  if (found.status !== 'ENROLLED') throw mockErrors.conflict('INVALID_STATE', 'Đăng ký này đã được hủy');
  if (!canCancelEnrollment(classesDb.findClass(found.class.id)?.startDate ?? null)) {
    throw mockErrors.conflict('INVALID_STATE', 'Lớp đã bắt đầu, không thể hủy đăng ký');
  }
  const refund = enrollmentRefund(found);

  const { enrollment, orderId } = commerceStore.update((state) => {
    const enrollment = state.enrollments.find((entry) => entry.id === id)!;
    enrollment.status = 'CANCELLED';
    enrollment.refundedAmount += refund;
    if (refund > 0) addRefundToItem(state, enrollment.orderItemId, refund);
    return { enrollment: { ...enrollment }, orderId: orderIdOf(state, enrollment.orderItemId) };
  });
  await creditRefund(
    actor,
    enrollment.account.id,
    refund,
    { orderId, orderItemId: enrollment.orderItemId, description: `Hoàn tiền hủy lớp ${enrollment.class.name}` },
    balanceOf,
    `refund:enrollment:${enrollment.id}`,
  );
  return { enrollment, refund };
}

/** `GET /bookings?date=` for the reception desk: every confirmed booking of a day, in time order. */
export function listBookingsOn(date: string): Booking[] {
  return commerceStore
    .get()
    .bookings.filter((booking) => booking.date === date && booking.status === 'CONFIRMED')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
