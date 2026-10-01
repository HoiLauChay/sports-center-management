import type { Prisma } from '~/generated/prisma/client';

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
  countPendingTopUps = (accountId: string, now: Date, tx: Prisma.TransactionClient) =>
    tx.invoice.count({
      where: { accountId, purpose: 'WALLET_TOP_UP', status: 'PENDING', expiresAt: { gt: now } },
    });

  create = (data: Prisma.InvoiceUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.invoice.create({ data, select: invoiceSelect });
}

export default new InvoiceRepository();
