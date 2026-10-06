import type { ListMyOrdersQuery, ListOrdersQuery, OrderStatus } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
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
  paymentMethod: true,
  coupon: { select: { code: true } },
  subtotal: true,
  membershipDiscountAmount: true,
  couponDiscountAmount: true,
  totalAmount: true,
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
      refundedAt: true,
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

const refunded = { refundedAt: { not: null } } satisfies Prisma.OrderItemWhereInput;
const refundable = { totalAmount: { gt: 0 }, refundedAt: null } satisfies Prisma.OrderItemWhereInput;

const statusFilter: Record<OrderStatus, Prisma.OrderWhereInput> = {
  PAID: { items: { none: refunded } },
  PARTIALLY_REFUNDED: { AND: [{ items: { some: refunded } }, { items: { some: refundable } }] },
  REFUNDED: { AND: [{ items: { some: refunded } }, { items: { none: refundable } }] },
};

class OrderRepository {
  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.order.findUnique({ where: { id }, select: orderSelect });

  findByIdempotencyKey = (idempotencyKey: string, tx: Prisma.TransactionClient = prisma) =>
    tx.order.findUnique({ where: { idempotencyKey }, select: orderSelect });

  findPage = ({ from, to, page, limit, ...filters }: ListOrdersQuery) => {
    const where: Prisma.OrderWhereInput = {
      accountId: filters.accountId,
      guestPhone: filters.guestPhone ?? undefined,
      ...(filters.status && statusFilter[filters.status]),
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
        refundedAt: true,
        itemSnapshot: true,
        order: { select: { id: true, orderNumber: true, accountId: true } },
      },
    });

  markRefunded = (tx: Prisma.TransactionClient, orderItemId: string, refundedAt: Date) =>
    tx.orderItem.update({ where: { id: orderItemId }, data: { refundedAt } });

  create = (data: Prisma.OrderUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.order.create({
      data,
      select: { id: true, orderNumber: true, items: { select: { id: true, lineNumber: true } } },
    });
}

export default new OrderRepository();
