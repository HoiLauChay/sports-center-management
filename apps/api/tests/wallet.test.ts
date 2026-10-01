import type { Wallet } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());
beforeEach(resetDatabase);

describe('wallet', () => {
  test('member and staff read the balance and ledger with top-up source', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    await prisma.memberProfile.update({ where: { accountId: member.id }, data: { walletBalance: 150_000 } });
    await prisma.walletTransaction.create({
      data: {
        accountId: member.id,
        transactionCode: 'GD260917TEST0001',
        idempotencyKey: `cash:${receptionist.id}:seed`,
        type: 'TOP_UP',
        topUpMethod: 'CASH',
        amount: 150_000,
        balanceAfter: 150_000,
        createdById: receptionist.id,
      },
    });

    const mine = await readResult<Wallet>(await request('GET', '/me/wallet', member));
    expect(mine.balance).toBe(150_000);
    expect(mine.transactions).toMatchObject({ total: 1, page: 1 });
    expect(mine.transactions.items[0]).toMatchObject({
      type: 'TOP_UP',
      amount: 150_000,
      source: 'COUNTER',
      method: 'CASH',
      createdBy: { id: receptionist.id },
    });

    const staffView = await request('GET', `/users/${member.id}/wallet`, receptionist);
    expect((await readResult<Wallet>(staffView)).balance).toBe(150_000);
    expect((await request('GET', `/users/${coach.id}/wallet`, receptionist)).status).toBe(404);
    expect((await request('GET', '/me/wallet', coach)).status).toBe(403);
  });
});
