import type { Paginated, Ref } from '@sports-center/shared';
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

/** Moves a booking to another facility at the same time because its facility goes into maintenance (BR_2.19). */
export function moveBookingForMaintenance(bookingId: string, facility: Ref) {
  commerceStore.update((state) => {
    const booking = state.bookings.find((entry) => entry.id === bookingId);
    if (booking?.status === 'CONFIRMED') booking.facility = facility;
  });
}

/** Refunds the whole enrollment line and cancels the enrollment when a manager cancels the class (BR_2.7b). */
export async function refundEnrollmentLine(
  actor: Actor,
  enrollmentId: string,
  description: string,
  balanceOf: BalanceOf,
) {
  const found = commerceStore.get().enrollments.find((entry) => entry.id === enrollmentId);
  if (!found) return 0;
  const refund = enrollmentRefund(found);

  const orderId = commerceStore.update((state) => {
    const enrollment = state.enrollments.find((entry) => entry.id === enrollmentId)!;
    enrollment.refundedAmount += refund;
    enrollment.status = 'CANCELLED';
    if (refund > 0) addRefundToItem(state, enrollment.orderItemId, refund);
    return orderIdOf(state, enrollment.orderItemId);
  });
  await creditRefund(
    actor,
    found.account.id,
    refund,
    { orderId, orderItemId: found.orderItemId, description },
    balanceOf,
    `refund:enrollment:${found.id}`,
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
