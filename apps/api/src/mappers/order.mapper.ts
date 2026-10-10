import type { Order, OrderStatus } from '@sports-center/shared';

import type { OrderRow } from '~/repositories/order.repository';

type ItemRow = OrderRow['items'][number];

const refIdOf = (item: ItemRow) =>
  item.bookings[0]?.id ?? item.facilityPackage?.id ?? item.enrollment?.id ?? item.membershipOrder?.membershipId ?? null;

const statusOf = (items: ItemRow[]): OrderStatus => {
  if (!items.some((item) => item.refundedAt)) return 'PAID';
  return items.some((item) => !item.refundedAt && Number(item.totalAmount) > 0) ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
};

const couponsOf = (row: OrderRow) => {
  const totals = new Map<string, number>();
  for (const item of row.items) {
    if (item.coupon)
      totals.set(item.coupon.code, (totals.get(item.coupon.code) ?? 0) + Number(item.couponDiscountAmount));
  }
  return [...totals].map(([code, discount]) => ({ code, discount }));
};

export const toOrderResponse = (row: OrderRow): Order => ({
  id: row.id,
  orderNumber: row.orderNumber,
  account: row.account,
  guestName: row.guestName,
  guestPhone: row.guestPhone,
  createdBy: row.createdBy,
  status: statusOf(row.items),
  paymentMethod: row.paymentMethod,
  coupons: couponsOf(row),
  subtotal: Number(row.subtotal),
  membershipDiscount: Number(row.membershipDiscountAmount),
  couponDiscount: Number(row.couponDiscountAmount),
  totalAmount: Number(row.totalAmount),
  items: row.items.map((item) => ({
    id: item.id,
    lineNumber: item.lineNumber,
    type: item.type,
    snapshot: item.itemSnapshot as Record<string, unknown>,
    subtotal: Number(item.subtotal),
    membershipDiscount: Number(item.membershipDiscountAmount),
    couponDiscount: Number(item.couponDiscountAmount),
    couponCode: item.coupon?.code ?? null,
    totalAmount: Number(item.totalAmount),
    refundedAt: item.refundedAt?.toISOString() ?? null,
    refId: refIdOf(item),
  })),
  refunds: row.walletTransactions.map((refund) => ({
    id: refund.id,
    transactionCode: refund.transactionCode,
    orderItemId: refund.orderItemId,
    amount: Number(refund.amount),
    reason: refund.description,
    createdAt: refund.createdAt.toISOString(),
  })),
  paidAt: row.createdAt.toISOString(),
});
