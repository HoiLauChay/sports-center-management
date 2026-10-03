import type { Order } from '@sports-center/shared';

import type { OrderRow } from '~/repositories/order.repository';

type ItemRow = OrderRow['items'][number];

const refIdOf = (item: ItemRow) =>
  item.bookings[0]?.id ?? item.facilityPackage?.id ?? item.enrollment?.id ?? item.membershipOrder?.membershipId ?? null;

export const toOrderResponse = (row: OrderRow): Order => ({
  id: row.id,
  orderNumber: row.orderNumber,
  account: row.account,
  guestName: row.guestName,
  guestPhone: row.guestPhone,
  createdBy: row.createdBy,
  status: row.status,
  paymentMethod: row.paymentMethod,
  coupon: row.coupon ? { code: row.coupon.code, discount: Number(row.couponDiscountAmount) } : null,
  subtotal: Number(row.subtotal),
  membershipDiscount: Number(row.membershipDiscountAmount),
  couponDiscount: Number(row.couponDiscountAmount),
  totalAmount: Number(row.totalAmount),
  refundedAmount: Number(row.refundedAmount),
  items: row.items.map((item) => ({
    id: item.id,
    lineNumber: item.lineNumber,
    type: item.type,
    snapshot: item.itemSnapshot as Record<string, unknown>,
    subtotal: Number(item.subtotal),
    membershipDiscount: Number(item.membershipDiscountAmount),
    couponDiscount: Number(item.couponDiscountAmount),
    totalAmount: Number(item.totalAmount),
    refundedAmount: Number(item.refundedAmount),
    refId: refIdOf(item),
  })),
  paidAt: row.createdAt.toISOString(),
});
