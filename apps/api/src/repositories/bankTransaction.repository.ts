import type { ListBankTransactionsQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { BankTransactionStatus, Prisma } from '~/generated/prisma/client';
import { pageOfGroups } from '~/utils/pagination';
import { toCenterDateTime } from '~/utils/time';

const person = { select: { id: true, fullName: true } } as const;

const bankTransactionSelect = {
  id: true,
  sepayId: true,
  bankName: true,
  accountNumber: true,
  amount: true,
  content: true,
  paymentCode: true,
  referenceCode: true,
  transactionDate: true,
  status: true,
  invoice: { select: { id: true, purpose: true, account: { select: { account: person } } } },
  resolvedAccountId: true,
  resolvedAccount: { select: { account: person } },
  handledBy: person,
  handledAt: true,
  note: true,
} satisfies Prisma.BankTransactionSelect;

export type BankTransactionRow = Prisma.BankTransactionGetPayload<{ select: typeof bankTransactionSelect }>;

const dayRange = (from?: string, to?: string): Prisma.DateTimeFilter | undefined =>
  from || to
    ? { ...(from && { gte: toCenterDateTime(from, 0) }), ...(to && { lt: toCenterDateTime(to, 24 * 60) }) }
    : undefined;

const reconcileGroups = (
  where: Prisma.BankTransactionWhereInput,
): Pick<Prisma.BankTransactionFindManyArgs, 'where' | 'orderBy'>[] => [
  {
    where: { AND: [where, { status: 'UNMATCHED' }] },
    orderBy: [{ transactionDate: 'asc' }, { id: 'asc' }],
  },
  {
    where: { AND: [where, { status: { not: 'UNMATCHED' } }] },
    orderBy: [{ transactionDate: 'desc' }, { id: 'desc' }],
  },
];

class BankTransactionRepository {
  insertIfNew = async (data: Prisma.BankTransactionCreateManyInput, tx: Prisma.TransactionClient) =>
    (await tx.bankTransaction.createManyAndReturn({ data, skipDuplicates: true, select: { id: true } }))[0] ?? null;

  existsWithoutReference = (
    {
      accountNumber,
      amount,
      transactionDate,
      content,
    }: Pick<Prisma.BankTransactionCreateManyInput, 'accountNumber' | 'amount' | 'transactionDate' | 'content'>,
    tx: Prisma.TransactionClient,
  ) =>
    tx.bankTransaction
      .findFirst({ where: { accountNumber, amount, transactionDate, content }, select: { id: true } })
      .then(Boolean);

  updateStatus = (id: string, status: BankTransactionStatus, tx: Prisma.TransactionClient, note?: string) =>
    tx.bankTransaction.update({ where: { id }, data: { status, note }, select: { id: true } });

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.bankTransaction.findUnique({ where: { id }, select: bankTransactionSelect });

  findPage = async ({ status, from, to, q, page, limit }: ListBankTransactionsQuery) => {
    const where: Prisma.BankTransactionWhereInput = {
      status,
      transactionDate: dayRange(from, to),
      ...(q && {
        OR: [
          { content: { contains: q, mode: 'insensitive' } },
          { referenceCode: { contains: q, mode: 'insensitive' } },
          { paymentCode: { contains: q.toUpperCase() } },
        ],
      }),
    };
    const groups = reconcileGroups(where);
    const sizes = await Promise.all(groups.map((group) => prisma.bankTransaction.count({ where: group.where })));
    const rows = await Promise.all(
      pageOfGroups(groups, sizes, { page, limit }).map((args) =>
        prisma.bankTransaction.findMany({ ...args, select: bankTransactionSelect }),
      ),
    );
    return [rows.flat(), sizes.reduce((total, size) => total + size, 0)] as const;
  };

  findForReconciliation = (accountNumber: string, from: string, to: string) =>
    prisma.bankTransaction.findMany({
      where: { accountNumber, transactionDate: dayRange(from, to) },
      select: { amount: true, referenceCode: true, transactionDate: true },
    });

  handle = (
    id: string,
    data: Pick<
      Prisma.BankTransactionUncheckedUpdateInput,
      'status' | 'resolvedAccountId' | 'handledById' | 'handledAt' | 'note'
    >,
    tx: Prisma.TransactionClient,
  ) => tx.bankTransaction.update({ where: { id }, data, select: bankTransactionSelect });
}

export default new BankTransactionRepository();
