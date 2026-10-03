import type { Invoice, Paginated, PaymentMethod } from '@sports-center/shared';
import type { Booking } from '~/features/bookings/types';
import type { Enrollment } from '~/features/classes/types';
import { commerceStore, type CommerceState, type StoredFacilityPackage } from '~/lib/mock/commerce';
import { MockApiError, mockErrors } from '~/lib/mock/errors';
import { walletLedger } from '~/lib/mock/ledger';
import { newId, nowIso } from '~/lib/mock/store';
import { nowVN, vnDate } from '~/lib/time';
import type { CheckoutRequest, ListOrdersQuery, Order, OrderItem, Quote, QuoteRequest } from '../types';
import { allocate, evaluate, type Actor, type Evaluation } from './pricing';

export type BalanceOf = (accountId: string) => Promise<number>;

/** Seconds after which a counter transfer "arrives" in the mock (the real flow waits for the SePay webhook). */
export const COUNTER_TRANSFER_DELAY_SECONDS = 15;

const MOCK_BANK = { bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'CONG TY SPORTS CENTER' };

export async function quoteOrder(actor: Actor, request: QuoteRequest, balanceOf: BalanceOf): Promise<Quote> {
  return (await evaluate(actor, request, balanceOf)).quote;
}

const normalizeCoupon = (code?: string) => code?.trim().toUpperCase() || undefined;

function requestHash(request: QuoteRequest & { paymentMethod?: PaymentMethod; expectedTotal?: number }) {
  return JSON.stringify([
    request.buyer ?? null,
    request.items,
    normalizeCoupon(request.couponCode) ?? null,
    request.paymentMethod ?? null,
    request.expectedTotal ?? null,
  ]);
}

function assertMethodAllowed(actor: Actor, method: PaymentMethod) {
  const allowed: PaymentMethod[] = actor.role === 'MEMBER' ? ['WALLET'] : ['CASH', 'CARD', 'TRANSFER'];
  if (!allowed.includes(method)) {
    throw new MockApiError(403, 'FORBIDDEN', 'Phương thức thanh toán này không dành cho tài khoản của bạn');
  }
}

/** Validates a checkout request against a fresh evaluation (BR_3.16–3.19); throws the documented 409/422 errors. */
function assertCheckoutable(evaluation: Evaluation, request: CheckoutRequest) {
  const { quote } = evaluation;
  if (!request.items.length) {
    throw new MockApiError(422, 'CART_EMPTY', 'Đơn hàng chưa có dịch vụ nào');
  }
  if (quote.items.some((item) => !item.valid)) {
    throw mockErrors.conflict('CART_ITEM_INVALID', 'Một số dịch vụ trong đơn không còn hợp lệ', { quote });
  }
  if (quote.coupon && !quote.coupon.valid) {
    throw mockErrors.conflict('COUPON_INVALID', quote.coupon.error ?? 'Mã giảm giá không hợp lệ', { quote });
  }
  if (quote.total !== request.expectedTotal) {
    throw mockErrors.conflict('PRICE_CHANGED', 'Giá đã thay đổi, vui lòng xem lại đơn hàng', { quote });
  }
}

function orderNumberOf(seq: number) {
  return `HD${nowVN().format('YYYYMMDD')}-${String(seq).padStart(4, '0')}`;
}

function recomputeStatus(order: Order) {
  order.refundedAmount = order.items.reduce((sum, item) => sum + item.refundedAmount, 0);
  order.status =
    order.refundedAmount <= 0 ? 'PAID' : order.refundedAmount >= order.totalAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
}

/** Adds a refund to one order line and rolls it up to the order (BR_3.7, BR_3.13). */
export function addRefundToItem(state: CommerceState, orderItemId: string, amount: number) {
  for (const order of state.orders) {
    const item = order.items.find((entry) => entry.id === orderItemId);
    if (!item) continue;
    item.refundedAmount += amount;
    recomputeStatus(order);
    return order;
  }
  return undefined;
}

function insertOrder(
  state: CommerceState,
  evaluation: Evaluation,
  actor: Actor,
  paymentMethod: PaymentMethod,
  idempotencyKey: string,
  hash: string,
): Order {
  const { quote, buyer, lines } = evaluation;
  const now = nowIso();
  const person = buyer.kind === 'MEMBER' ? buyer.person : null;
  const guest = buyer.kind === 'GUEST' ? buyer : null;

  const items: OrderItem[] = lines.map((line) => {
    const orderItemId = newId();
    let refId = newId();
    const total = line.item.total;
    const owner = {
      account: person,
      guestName: guest?.name ?? null,
      guestPhone: guest?.phone ?? null,
    };

    if (line.item.type === 'FACILITY_BOOKING' && line.facility) {
      const part = line.parts[0]!;
      const booking: Booking = {
        id: refId,
        facility: { id: line.facility.id, name: line.facility.name },
        date: part.date,
        startTime: part.startTime,
        endTime: part.endTime,
        status: 'CONFIRMED',
        unitPrice: part.list,
        benefit: part.benefit,
        paidAmount: total,
        refundedAmount: 0,
        packageId: null,
        orderItemId,
        ...owner,
        createdAt: now,
      };
      state.bookings.push(booking);
    } else if (line.item.type === 'FACILITY_PACKAGE' && line.facility) {
      const packageId = refId;
      const shares = allocate(
        total,
        line.parts.map((part) => part.price),
      );
      const bookingIds = line.parts.map((part, index) => {
        const booking: Booking = {
          id: newId(),
          facility: { id: line.facility!.id, name: line.facility!.name },
          date: part.date,
          startTime: part.startTime,
          endTime: part.endTime,
          status: 'CONFIRMED',
          unitPrice: part.list,
          benefit: part.benefit,
          paidAmount: shares[index]!,
          refundedAmount: 0,
          packageId,
          orderItemId,
          ...owner,
          createdAt: now,
        };
        state.bookings.push(booking);
        return booking.id;
      });
      const selection = line.item.selection;
      if (selection.type === 'FACILITY_PACKAGE') {
        const stored: StoredFacilityPackage = {
          id: packageId,
          facility: { id: line.facility.id, name: line.facility.name },
          startDate: line.parts[0]!.date,
          endDate: line.parts.at(-1)!.date,
          daysOfWeek: selection.daysOfWeek,
          startTime: selection.startTime,
          endTime: selection.endTime,
          status: 'ACTIVE',
          unitPrice: line.parts[0]?.list ?? 0,
          bookingIds,
          accountId: person?.id ?? '',
          orderItemId,
        };
        state.packages.push(stored);
      }
    } else if (line.item.type === 'COURSE_ENROLLMENT' && line.classId && person) {
      const name = String(line.item.snapshot.className ?? '');
      const enrollment: Enrollment = {
        id: refId,
        class: { id: line.classId, name },
        account: person,
        status: 'ENROLLED',
        paidAmount: total,
        refundedAmount: 0,
        orderItemId,
        enrolledAt: now,
      };
      state.enrollments.push(enrollment);
    } else {
      refId = newId();
    }

    return {
      id: orderItemId,
      lineNumber: line.item.lineNumber,
      type: line.item.type,
      snapshot: line.item.snapshot,
      subtotal: line.item.subtotal,
      membershipDiscount: line.item.membershipDiscount,
      couponDiscount: line.item.couponDiscount,
      totalAmount: total,
      refundedAmount: 0,
      refId,
    };
  });

  state.orderSeq += 1;
  const order: Order = {
    id: newId(),
    orderNumber: orderNumberOf(state.orderSeq),
    account: person,
    guestName: guest?.name ?? null,
    guestPhone: guest?.phone ?? null,
    createdBy: { id: actor.id, fullName: actor.fullName },
    status: 'PAID',
    paymentMethod,
    coupon: quote.coupon?.valid ? { code: quote.coupon.code, discount: quote.couponDiscount } : null,
    subtotal: quote.subtotal,
    membershipDiscount: quote.membershipDiscount,
    couponDiscount: quote.couponDiscount,
    totalAmount: quote.total,
    refundedAmount: 0,
    items,
    paidAt: now,
  };
  state.orders.unshift(order);
  state.checkouts[idempotencyKey] = { hash, orderId: order.id };
  return order;
}

/** `POST /checkout` for WALLET / CASH / CARD (BR_3.2: all or nothing, same request never creates two orders). */
export async function checkoutOrder(actor: Actor, request: CheckoutRequest, balanceOf: BalanceOf): Promise<Order> {
  assertMethodAllowed(actor, request.paymentMethod);
  if (request.paymentMethod === 'TRANSFER') {
    throw mockErrors.invalid('body.paymentMethod', 'Chuyển khoản tạo hóa đơn QR, không thanh toán trực tiếp');
  }
  const hash = requestHash(request);
  const known = commerceStore.get().checkouts[request.idempotencyKey];
  if (known) {
    if (known.hash !== hash) {
      throw mockErrors.conflict('IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đã được dùng cho một đơn khác');
    }
    const existing = commerceStore.get().orders.find((order) => order.id === known.orderId);
    if (existing) return existing;
  }

  const evaluation = await evaluate(actor, request, balanceOf);
  assertCheckoutable(evaluation, request);
  const { quote, buyer } = evaluation;

  if (request.paymentMethod === 'WALLET') {
    const balance = quote.walletBalance ?? 0;
    if (balance < quote.total) {
      throw mockErrors.conflict('INSUFFICIENT_BALANCE', 'Số dư ví không đủ để thanh toán đơn hàng');
    }
  }

  const order = commerceStore.update((state) => {
    const duplicate = state.checkouts[request.idempotencyKey];
    const existing = duplicate && state.orders.find((entry) => entry.id === duplicate.orderId);
    return existing ?? insertOrder(state, evaluation, actor, request.paymentMethod, request.idempotencyKey, hash);
  });

  if (request.paymentMethod === 'WALLET' && buyer.kind === 'MEMBER' && quote.total > 0) {
    const serverBalance = (quote.walletBalance ?? 0) - walletLedger.delta(buyer.person.id);
    walletLedger.record({
      accountId: buyer.person.id,
      serverBalance,
      type: 'PAYMENT',
      amount: quote.total,
      orderId: order.id,
      createdBy: { id: actor.id, fullName: actor.fullName },
      description: `Thanh toán đơn ${order.orderNumber}`,
      idempotencyKey: `payment:${order.id}`,
    });
  }
  return order;
}

function newPaymentCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `SCOD${Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')}`;
}

/** Counter order paid by bank transfer: creates a `COUNTER_ORDER` invoice with a QR; the order exists only once paid. */
export async function startCounterTransfer(
  actor: Actor,
  request: CheckoutRequest,
  balanceOf: BalanceOf,
  invoiceExpiryMinutes: number,
): Promise<Invoice> {
  if (actor.role !== 'RECEPTIONIST') throw new MockApiError(403, 'FORBIDDEN', 'Chỉ lễ tân tạo hóa đơn tại quầy');
  const hash = requestHash(request);
  const existing = commerceStore
    .get()
    .counterInvoices.find((entry) => entry.request.idempotencyKey === request.idempotencyKey);
  if (existing) {
    if (requestHash(existing.request) !== hash) {
      throw mockErrors.conflict('IDEMPOTENCY_CONFLICT', 'Mã yêu cầu đã được dùng cho một đơn khác');
    }
    return existing.invoice;
  }

  const evaluation = await evaluate(actor, request, balanceOf);
  assertCheckoutable(evaluation, request);
  if (evaluation.quote.total <= 0) {
    throw mockErrors.invalid('body.paymentMethod', 'Đơn 0đ không cần chuyển khoản, hãy chọn tiền mặt hoặc thẻ');
  }
  const { buyer, quote } = evaluation;
  const paymentCode = newPaymentCode();
  const invoice: Invoice = {
    id: newId(),
    paymentCode,
    purpose: 'COUNTER_ORDER',
    account: buyer.kind === 'MEMBER' ? buyer.person : null,
    guestName: buyer.kind === 'GUEST' ? buyer.name : null,
    guestPhone: buyer.kind === 'GUEST' ? buyer.phone : null,
    amount: quote.total,
    status: 'PENDING',
    bankAccount: MOCK_BANK,
    transferContent: paymentCode,
    qrImageUrl: `https://qr.sepay.vn/img?acc=${MOCK_BANK.accountNumber}&bank=${MOCK_BANK.bankCode}&amount=${quote.total}&des=${paymentCode}`,
    expiresAt: nowVN().add(invoiceExpiryMinutes, 'minute').toISOString(),
    paidAt: null,
    orderId: null,
    createdBy: { id: actor.id, fullName: actor.fullName },
    createdAt: nowIso(),
  };
  commerceStore.update((state) => {
    state.counterInvoices.unshift({ invoice, request, actor });
  });
  return invoice;
}

/**
 * `GET /invoices/{id}` for counter invoices. The mock lets the transfer "arrive" a few seconds after the invoice was
 * created and then turns it into an order; if the order can no longer be created the invoice fails instead.
 */
export async function getCounterInvoice(id: string, balanceOf: BalanceOf): Promise<Invoice> {
  const entry = commerceStore.get().counterInvoices.find((candidate) => candidate.invoice.id === id);
  if (!entry) throw mockErrors.notFound('Không tìm thấy hóa đơn');
  const { invoice } = entry;
  if (invoice.status !== 'PENDING') return invoice;

  const age = (Date.now() - new Date(invoice.createdAt).getTime()) / 1000;
  const save = (patch: Partial<Invoice>) =>
    commerceStore.update((state) => {
      const stored = state.counterInvoices.find((candidate) => candidate.invoice.id === id)!;
      if (stored.invoice.status === 'PENDING') Object.assign(stored.invoice, patch);
      return stored.invoice;
    });

  if (age >= COUNTER_TRANSFER_DELAY_SECONDS) {
    try {
      const evaluation = await evaluate(entry.actor, entry.request, balanceOf);
      assertCheckoutable(evaluation, entry.request);
      const order = commerceStore.update((state) =>
        insertOrder(
          state,
          evaluation,
          entry.actor,
          'TRANSFER',
          `${entry.request.idempotencyKey}:paid`,
          requestHash(entry.request),
        ),
      );
      return save({ status: 'PAID', paidAt: nowIso(), orderId: order.id });
    } catch {
      return save({ status: 'FAILED' });
    }
  }
  if (new Date(invoice.expiresAt).getTime() <= Date.now()) return save({ status: 'EXPIRED' });
  return invoice;
}

export function cancelCounterInvoice(id: string): Invoice {
  return commerceStore.update((state) => {
    const entry = state.counterInvoices.find((candidate) => candidate.invoice.id === id);
    if (!entry) throw mockErrors.notFound('Không tìm thấy hóa đơn');
    if (entry.invoice.status !== 'PENDING') {
      throw mockErrors.conflict('INVALID_STATE', 'Chỉ hủy được hóa đơn đang chờ thanh toán');
    }
    entry.invoice.status = 'CANCELLED';
    return entry.invoice;
  });
}

export function listOrders(actor: Actor, query: ListOrdersQuery): Paginated<Order> {
  const orderNumber = query.orderNumber?.trim().toLowerCase();
  const phone = query.guestPhone?.trim();
  const rows = commerceStore
    .get()
    .orders.filter((order) => {
      if (actor.role === 'MEMBER' && order.account?.id !== actor.id) return false;
      if (query.accountId && order.account?.id !== query.accountId) return false;
      if (query.status && order.status !== query.status) return false;
      if (orderNumber && !order.orderNumber.toLowerCase().includes(orderNumber)) return false;
      if (phone && !(order.guestPhone ?? '').includes(phone)) return false;
      const paidDay = vnDate(order.paidAt);
      if (query.from && paidDay < query.from) return false;
      if (query.to && paidDay > query.to) return false;
      return true;
    })
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const start = (query.page - 1) * query.limit;
  return { items: rows.slice(start, start + query.limit), page: query.page, limit: query.limit, total: rows.length };
}

export function getOrder(actor: Actor, id: string): Order {
  const order = commerceStore.get().orders.find((entry) => entry.id === id);
  if (!order || (actor.role === 'MEMBER' && order.account?.id !== actor.id))
    throw mockErrors.notFound('Không tìm thấy đơn hàng');
  return order;
}
