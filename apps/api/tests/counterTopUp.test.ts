import type { WalletTransaction } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { expectWalletConsistent } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/users'));
});

afterAll(() => server.close());
beforeEach(resetDatabase);

describe('counter top-up', () => {
  test('resending the same key credits the wallet once and is audited', async () => {
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const body = { amount: 200_000, method: 'CASH', idempotencyKey: 'counter-top-up-1' };

    expect((await request('POST', `/${member.id}/wallet/top-ups`, member, body)).status).toBe(403);

    const responses = await Promise.all(
      [1, 2, 3].map(() => request('POST', `/${member.id}/wallet/top-ups`, receptionist, body)),
    );
    expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
    const transactions = await Promise.all(responses.map((response) => readResult<WalletTransaction>(response)));
    expect(new Set(transactions.map(({ id }) => id)).size).toBe(1);
    expect(transactions[0]).toMatchObject({
      type: 'TOP_UP',
      source: 'COUNTER',
      method: 'CASH',
      amount: 200_000,
      createdBy: { id: receptionist.id },
    });
    expect(await expectWalletConsistent(member.id)).toBe(200_000);
    expect(await prisma.auditLog.count({ where: { entityType: 'WALLET_TRANSACTION' } })).toBe(1);

    const changed = await request('POST', `/${member.id}/wallet/top-ups`, receptionist, { ...body, amount: 300_000 });
    expect(await readCode(changed)).toBe('IDEMPOTENCY_CONFLICT');
    expect(await expectWalletConsistent(member.id)).toBe(200_000);
  });

  test('only active members can be topped up', async () => {
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    const locked = await createAccount('MEMBER', 'locked@example.com', { status: 'BANNED' });
    const body = { amount: 100_000, method: 'CARD', idempotencyKey: 'counter-top-up-2' };

    expect((await request('POST', `/${coach.id}/wallet/top-ups`, receptionist, body)).status).toBe(404);
    expect((await request('POST', `/${locked.id}/wallet/top-ups`, receptionist, body)).status).toBe(404);
    expect(await prisma.walletTransaction.count()).toBe(0);
  });
});
