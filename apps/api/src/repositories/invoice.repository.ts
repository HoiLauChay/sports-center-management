import type { ListMyInvoicesQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';

const person = { select: { id: true, fullName: true } } as const;

const invoiceSelect = {
  id: true,
  paymentCode: true,
  purpose: true,
  accountId: true,
  account: { select: { account: person } },
  guestName: true,
  guestPhone: true,
  amount: true,
  status: true,
  expiresAt: true,
  paidAt: true,
  orderId: true,
  createdBy: person,
  createdAt: true,
} satisfies Prisma.InvoiceSelect;

const heldOrders = (now: Date) =>
  ({ purpose: 'COUNTER_ORDER', status: 'PENDING', expiresAt: { gt: now } }) satisfies Prisma.InvoiceWhereInput;

export type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;

class InvoiceRepository {
  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.findUnique({ where: { id }, select: invoiceSelect });

  findByPaymentCode = (paymentCode: string, tx: Prisma.TransactionClient) =>
    tx.invoice.findUnique({
      where: { paymentCode },
      select: { id: true, purpose: true, accountId: true, amount: true, status: true },
    });

  markPaid = (id: string, bankTransactionId: string, tx: Prisma.TransactionClient, orderId?: string) =>
    tx.invoice.update({
      where: { id },
      data: { status: 'PAID', bankTransactionId, paidAt: new Date(), orderId },
      select: { id: true },
    });

  markFailed = (id: string, bankTransactionId: string, tx: Prisma.TransactionClient) =>
    tx.invoice.update({
      where: { id },
      data: { status: 'FAILED', bankTransactionId, paidAt: new Date() },
      select: { id: true },
    });

  cancel = (id: string, tx: Prisma.TransactionClient) =>
    tx.invoice.update({ where: { id }, data: { status: 'CANCELLED' }, select: invoiceSelect });

  findCounterOrder = (id: string, tx: Prisma.TransactionClient) =>
    tx.invoice.findUnique({
      where: { id, purpose: 'COUNTER_ORDER' },
      select: {
        id: true,
        paymentCode: true,
        accountId: true,
        amount: true,
        status: true,
        expiresAt: true,
        requestPayload: true,
        createdById: true,
      },
    });

  findHeldOrders = (now: Date, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.findMany({
      where: heldOrders(now),
      select: { accountId: true, requestPayload: true },
      orderBy: { createdAt: 'asc' },
    });

  countHeldOrders = (buyer: { accountId: string } | { guestPhone: string }, now: Date, tx: Prisma.TransactionClient) =>
    tx.invoice.count({ where: { ...heldOrders(now), ...buyer } });

  countHeldCoupon = async (couponId: string, accountId: string, now: Date, tx: Prisma.TransactionClient = prisma) => {
    const where = {
      ...heldOrders(now),
      requestPayload: { path: ['prepared', 'coupons'], array_contains: [{ id: couponId, applied: true }] },
    };
    const total = await tx.invoice.count({ where });
    const mine = await tx.invoice.count({ where: { ...where, accountId } });
    return [total, mine] as const;
  };

  findPage = (accountId: string, { purpose, status, ...page }: ListMyInvoicesQuery) => {
    const where: Prisma.InvoiceWhereInput = { accountId, purpose, status };
    return Promise.all([
      prisma.invoice.findMany({
        where,
        select: invoiceSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      prisma.invoice.count({ where }),
    ]);
  };

  countPendingTopUps = (accountId: string, now: Date, tx: Prisma.TransactionClient) =>
    tx.invoice.count({
      where: { accountId, purpose: 'WALLET_TOP_UP', status: 'PENDING', expiresAt: { gt: now } },
    });

  create = (data: Prisma.InvoiceUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.invoice.create({ data, select: invoiceSelect });
}

export default new InvoiceRepository();
