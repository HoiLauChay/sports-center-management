import type { WalletQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';

const walletTransactionSelect = {
  id: true,
  transactionCode: true,
  type: true,
  topUpMethod: true,
  amount: true,
  balanceAfter: true,
  orderId: true,
  orderItemId: true,
  bankTransactionId: true,
  createdBy: { select: { id: true, fullName: true } },
  description: true,
  createdAt: true,
} satisfies Prisma.WalletTransactionSelect;

export type WalletTransactionRow = Prisma.WalletTransactionGetPayload<{ select: typeof walletTransactionSelect }>;

class WalletRepository {
  findBalance = (accountId: string) =>
    prisma.memberProfile.findUnique({ where: { accountId }, select: { walletBalance: true } });

  findTransactionPage = (accountId: string, { type, ...page }: WalletQuery) => {
    const where: Prisma.WalletTransactionWhereInput = { accountId, type };
    return Promise.all([
      prisma.walletTransaction.findMany({
        where,
        select: walletTransactionSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      prisma.walletTransaction.count({ where }),
    ]);
  };
}

export default new WalletRepository();
