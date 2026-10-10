import type { Order, OrderStatus } from '@sports-center/shared';

import type { OrderRow } from '~/repositories/order.repository';

type ItemRow = OrderRow['items'][number];

const refIdOf = (item: ItemRow) =>
  item.bookings[0]?.id ?? item.facilityPackage?.id ?? item.enrollment?.id ?? item.membershipOrder?.membershipId ?? null;

const statusOf = (items: ItemRow[]): OrderStatus => {
  if (!items.some((item) => item.refundedAt)) return 'PAID';
  return items.some((item) => !item.refundedAt && Number(item.totalAmount) > 0) ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
};

const couponOf = (row: OrderRow) => {
  const code = row.items.find((item) => item.coupon)?.coupon?.code;
  return code ? { code, discount: Number(row.couponDiscountAmount) } : null;
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
  coupon: couponOf(row),
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
