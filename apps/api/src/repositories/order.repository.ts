import type { ListMyOrdersQuery, ListOrdersQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { OrderStatus, Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';
import { toCenterDateTime } from '~/utils/time';

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
  receiptSnapshot: true,
  createdAt: true,
  walletTransactions: {
    where: { type: 'REFUND' },
    select: {
      id: true,
      transactionCode: true,
      orderItemId: true,
      amount: true,
      description: true,
      createdAt: true,
      createdBy: person,
    },
    orderBy: { createdAt: 'asc' },
  },
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

const dayRange = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
  from || to
    ? {
        ...(from && { gte: toCenterDateTime(from, 0) }),
        ...(to && { lt: toCenterDateTime(to, 24 * 60) }),
      }
    : undefined;

class OrderRepository {
  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.order.findUnique({ where: { id }, select: orderSelect });

  findByIdempotencyKey = (idempotencyKey: string, tx: Prisma.TransactionClient = prisma) =>
    tx.order.findUnique({ where: { idempotencyKey }, select: orderSelect });

  findPage = ({ from, to, page, limit, ...filters }: ListOrdersQuery) => {
    const where: Prisma.OrderWhereInput = {
      accountId: filters.accountId,
      guestPhone: filters.guestPhone ?? undefined,
      status: filters.status,
      orderNumber: filters.orderNumber,
      createdAt: dayRange(from, to),
    };
    return Promise.all([
      prisma.order.findMany({
        where,
        select: orderSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs({ page, limit }),
      }),
      prisma.order.count({ where }),
    ]);
  };

  findPageOfAccount = (accountId: string, { from, to, page, limit }: ListMyOrdersQuery) =>
    this.findPage({ accountId, from, to, page, limit });

  findItemForRefund = (id: string, tx: Prisma.TransactionClient) =>
    tx.orderItem.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        totalAmount: true,
        refundedAmount: true,
        itemSnapshot: true,
        order: { select: { id: true, orderNumber: true, accountId: true, totalAmount: true, refundedAmount: true } },
      },
    });

  addRefund = async (
    tx: Prisma.TransactionClient,
    {
      orderId,
      orderItemId,
      amount,
      status,
    }: { orderId: string; orderItemId: string; amount: number; status: OrderStatus },
  ) => {
    await tx.orderItem.update({ where: { id: orderItemId }, data: { refundedAmount: { increment: amount } } });
    await tx.order.update({ where: { id: orderId }, data: { refundedAmount: { increment: amount }, status } });
  };

  create = (data: Prisma.OrderUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.order.create({
      data,
      select: { id: true, orderNumber: true, items: { select: { id: true, lineNumber: true } } },
    });
}

export default new OrderRepository();
