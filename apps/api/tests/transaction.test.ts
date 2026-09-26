import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';
import { resetDatabase } from './helpers/db';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(resetDatabase);

describe('withScheduleLock', () => {
  test('serializes concurrent check-then-insert transactions', async () => {
    const reserve = (name: string) =>
      runTransaction(async (tx) => {
        await withScheduleLock(tx);
        const taken = await tx.sport.count();
        await sleep(200);
        if (taken === 0) await tx.sport.create({ data: { name } });
      });

    await Promise.all([reserve('A'), reserve('B')]);

    expect(await prisma.sport.count()).toBe(1);
  });
});

describe('runTransaction', () => {
  test('retries a transaction aborted by a deadlock', async () => {
    const [a, b] = await Promise.all([
      prisma.sport.create({ data: { name: 'A' } }),
      prisma.sport.create({ data: { name: 'B' } }),
    ]);
    let attempts = 0;
    const touch = (tx: Prisma.TransactionClient, id: string) =>
      tx.sport.update({ where: { id }, data: { description: String(attempts) } });
    const run = (first: string, second: string) =>
      runTransaction(async (tx) => {
        attempts++;
        await touch(tx, first);
        await sleep(200);
        await touch(tx, second);
      });

    await Promise.all([run(a.id, b.id), run(b.id, a.id)]);

    expect(attempts).toBe(3);
  });
});

describe('lockRows', () => {
  test('locks rows in a canonical order so opposite requests do not deadlock', async () => {
    const accounts = await Promise.all(
      ['a@example.com', 'b@example.com'].map((email) =>
        prisma.account.create({ data: { email, passwordHash: 'hash', fullName: email } }),
      ),
    );
    const ids = accounts.map(({ id }) => id);
    let attempts = 0;
    const run = (order: string[]) =>
      runTransaction(async (tx) => {
        attempts++;
        await lockRows(tx, { systemSettings: 'share', accounts: order });
        await sleep(200);
        for (const id of order) await tx.account.update({ where: { id }, data: { address: String(attempts) } });
      });

    await Promise.all([run(ids), run([...ids].reverse())]);

    expect(attempts).toBe(2);
  });
});
