import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import { ErrorWithStatus } from '~/rules/error';
import { idempotencyKey, withIdempotency } from '~/utils/idempotency';
import { resetDatabase } from './helpers/db';

let accountId: string;

beforeEach(async () => {
  await resetDatabase();
  const account = await prisma.account.create({
    data: { email: 'member@example.com', passwordHash: 'hash', fullName: 'Member', memberProfile: { create: {} } },
  });
  accountId = account.id;
});

const topUp = (key: string, amount: number) =>
  withIdempotency({
    find: () => prisma.walletTransaction.findUnique({ where: { idempotencyKey: key } }),
    matches: (existing) => existing.accountId === accountId && existing.amount.equals(amount),
    execute: () =>
      prisma.walletTransaction.create({
        data: {
          accountId,
          transactionCode: `TX-${crypto.randomUUID()}`,
          idempotencyKey: key,
          type: 'TOP_UP',
          topUpMethod: 'CASH',
          amount,
          balanceAfter: amount,
        },
      }),
  });

describe('withIdempotency', () => {
  test('executes a new key once and replays it for the same payload, even concurrently', async () => {
    const key = idempotencyKey.cash('receptionist-1', 'client-1');

    const [first, second] = await Promise.all([topUp(key, 100_000), topUp(key, 100_000)]);
    const third = await topUp(key, 100_000);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(await prisma.walletTransaction.count()).toBe(1);
  });

  test('rejects the same key with a different payload', async () => {
    const key = idempotencyKey.cash('receptionist-1', 'client-1');
    await topUp(key, 100_000);

    const error = await topUp(key, 200_000).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ErrorWithStatus);
    expect((error as ErrorWithStatus).code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await prisma.walletTransaction.count()).toBe(1);
  });
});
