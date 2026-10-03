import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const person = { select: { id: true, fullName: true } } as const;

const orderSelect = {
  id: true,
  orderNumber: true,
  requestHash: true,
  account: person,
  guestName: true,
  guestPhone: true,
  createdBy: person,
  status: true,
  paymentMethod: true,
  coupon: { select: { code: true } },
  subtotal: true,
  membershipDiscountAmount: true,
  couponDiscountAmount: true,
  totalAmount: true,
  refundedAmount: true,
  createdAt: true,
  items: {
    select: {
      id: true,
      lineNumber: true,
      type: true,
      itemSnapshot: true,
      subtotal: true,
      membershipDiscountAmount: true,
      couponDiscountAmount: true,
      totalAmount: true,
      refundedAmount: true,
      bookings: { select: { id: true }, where: { packageId: null }, take: 1 },
      facilityPackage: { select: { id: true } },
      enrollment: { select: { id: true } },
      membershipOrder: { select: { membershipId: true } },
    },
    orderBy: { lineNumber: 'asc' },
  },
} satisfies Prisma.OrderSelect;

export type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

class OrderRepository {
  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.order.findUnique({ where: { id }, select: orderSelect });

  findByIdempotencyKey = (idempotencyKey: string, tx: Prisma.TransactionClient = prisma) =>
    tx.order.findUnique({ where: { idempotencyKey }, select: orderSelect });

  create = (data: Prisma.OrderUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.order.create({
      data,
      select: { id: true, orderNumber: true, items: { select: { id: true, lineNumber: true } } },
    });
}

export default new OrderRepository();
