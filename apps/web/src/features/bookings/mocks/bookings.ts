import type { Paginated, SystemSettings } from '@sports-center/shared';
import { addRefundToItem, type BalanceOf } from '~/features/checkout/mocks/checkout';
import type { Actor } from '~/features/checkout/mocks/pricing';
import { bookingRefund, enrollmentRefund } from '~/features/checkout/refundPolicy';
import { classesDb } from '~/features/classes/mocks/classes';
import type { Enrollment, MyEnrollment } from '~/features/classes/types';
import { commerceStore, type CommerceState, type StoredFacilityPackage } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { walletLedger } from '~/lib/mock/ledger';
import { isPast } from '~/lib/time';
import type { Booking, CancelBookingResult, CancelPackageResult, FacilityPackage, Refund } from '../types';

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

export async function cancelBooking(
  actor: Actor,
  id: string,
  settings: SystemSettings,
  balanceOf: BalanceOf,
): Promise<CancelBookingResult> {
  const found = commerceStore.get().bookings.find((entry) => entry.id === id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lượt đặt');
  assertOwner(actor, found.account?.id);
  if (found.status !== 'CONFIRMED') throw mockErrors.conflict('INVALID_STATE', 'Lượt đặt này đã được hủy');
  if (isPast(found.date, found.startTime)) {
    throw mockErrors.conflict('INVALID_STATE', 'Lượt đặt đã diễn ra, không thể hủy');
  }
  const refund = bookingRefund(found, settings);

  const { booking, orderId } = commerceStore.update((state) => {
    const booking = state.bookings.find((entry) => entry.id === id)!;
    booking.status = 'CANCELLED';
    booking.refundedAmount += refund.amount;
    if (refund.amount > 0) addRefundToItem(state, booking.orderItemId, refund.amount);
    return { booking: { ...booking }, orderId: orderIdOf(state, booking.orderItemId) };
  });
  await creditRefund(
    actor,
    booking.account?.id,
    refund.amount,
    { orderId, orderItemId: booking.orderItemId, description: `Hoàn tiền hủy lượt đặt ${booking.facility.name}` },
    balanceOf,
    `refund:booking:${booking.id}`,
  );
  return { booking, refund };
}

export async function cancelPackage(
  actor: Actor,
  id: string,
  settings: SystemSettings,
  balanceOf: BalanceOf,
): Promise<CancelPackageResult> {
  const stored = commerceStore.get().packages.find((entry) => entry.id === id);
  if (!stored) throw mockErrors.notFound('Không tìm thấy gói định kỳ');
  assertOwner(actor, stored.accountId);
  if (stored.status !== 'ACTIVE') throw mockErrors.conflict('INVALID_STATE', 'Gói này đã được hủy');

  const result = commerceStore.update((state) => {
    const pkg = state.packages.find((entry) => entry.id === id)!;
    pkg.status = 'CANCELLED';
    let cancelled = 0;
    let refundTotal = 0;
    for (const booking of state.bookings.filter((entry) => pkg.bookingIds.includes(entry.id))) {
      if (booking.status !== 'CONFIRMED' || isPast(booking.date, booking.startTime)) continue;
      const refund: Refund = bookingRefund(booking, settings);
      booking.status = 'CANCELLED';
      booking.refundedAmount += refund.amount;
      cancelled += 1;
      refundTotal += refund.amount;
    }
    if (refundTotal > 0) addRefundToItem(state, pkg.orderItemId, refundTotal);
    return {
      package: expandPackage(state, pkg),
      cancelledBookings: cancelled,
      refundTotal,
      orderItemId: pkg.orderItemId,
      orderId: orderIdOf(state, pkg.orderItemId),
    };
  });

  await creditRefund(
    actor,
    stored.accountId,
    result.refundTotal,
    {
      orderId: result.orderId,
      orderItemId: result.orderItemId,
      description: `Hoàn tiền hủy gói định kỳ ${stored.facility.name}`,
    },
    balanceOf,
    `refund:package:${id}`,
  );
  return { package: result.package, cancelledBookings: result.cancelledBookings, refundTotal: result.refundTotal };
}

export async function cancelEnrollment(
  actor: Actor,
  id: string,
  settings: SystemSettings,
  balanceOf: BalanceOf,
): Promise<{ enrollment: Enrollment; refund: Refund }> {
  const found = commerceStore.get().enrollments.find((entry) => entry.id === id);
  if (!found) throw mockErrors.notFound('Không tìm thấy đăng ký lớp');
  assertOwner(actor, found.account.id);
  if (found.status !== 'ENROLLED') throw mockErrors.conflict('INVALID_STATE', 'Đăng ký này đã được hủy');
  const first = classesDb.sessionsOf(found.class.id).find((session) => session.status === 'SCHEDULED');
  const refund = enrollmentRefund(found, first?.date ?? null, settings);

  const { enrollment, orderId } = commerceStore.update((state) => {
    const enrollment = state.enrollments.find((entry) => entry.id === id)!;
    enrollment.status = 'CANCELLED';
    enrollment.refundedAmount += refund.amount;
    if (refund.amount > 0) addRefundToItem(state, enrollment.orderItemId, refund.amount);
    return { enrollment: { ...enrollment }, orderId: orderIdOf(state, enrollment.orderItemId) };
  });
  await creditRefund(
    actor,
    enrollment.account.id,
    refund.amount,
    { orderId, orderItemId: enrollment.orderItemId, description: `Hoàn tiền hủy lớp ${enrollment.class.name}` },
    balanceOf,
    `refund:enrollment:${enrollment.id}`,
  );
  return { enrollment, refund };
}
