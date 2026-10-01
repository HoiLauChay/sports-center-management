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

export type InvoiceRow = Prisma.InvoiceGetPayload<{ select: typeof invoiceSelect }>;

class InvoiceRepository {
  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.invoice.findUnique({ where: { id }, select: invoiceSelect });

  findByPaymentCode = (paymentCode: string, tx: Prisma.TransactionClient) =>
    tx.invoice.findUnique({
      where: { paymentCode },
      select: { id: true, purpose: true, accountId: true, amount: true, status: true },
    });

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
