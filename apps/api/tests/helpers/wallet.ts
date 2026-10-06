import { expect } from 'bun:test';

import { prisma } from '~/configs/db';

export const expectWalletConsistent = async (accountId: string) => {
  const [profile, transactions] = await Promise.all([
    prisma.memberProfile.findUniqueOrThrow({ where: { accountId }, select: { walletBalance: true } }),
    prisma.walletTransaction.findMany({ where: { accountId }, orderBy: { createdAt: 'asc' } }),
  ]);
  const balance = Number(profile.walletBalance);
  const net = transactions.reduce(
    (sum, { type, amount }) => sum + (type === 'PAYMENT' ? -Number(amount) : Number(amount)),
    0,
  );

  expect(balance).toBe(net);
  expect(Number(transactions.at(-1)?.balanceAfter ?? 0)).toBe(balance);
  return balance;
};

export const seedBalance = async (accountId: string, amount: number) => {
  await prisma.memberProfile.update({ where: { accountId }, data: { walletBalance: amount } });
  await prisma.walletTransaction.create({
    data: {
      accountId,
      transactionCode: `GD261003S${accountId.slice(0, 7).toUpperCase()}`,
      idempotencyKey: `seed:${accountId}`,
      type: 'TOP_UP',
      topUpMethod: 'CASH',
      amount,
      balanceAfter: amount,
    },
  });
};
