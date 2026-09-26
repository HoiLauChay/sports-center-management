import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import { resetDatabase } from './helpers/db';

const SECRET = 'test-cron-secret-at-least-32-characters';
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

let server: Server;
let baseUrl: string;

const callCleanup = (authorization?: string) =>
  fetch(`${baseUrl}/api/v1/cron/cleanup`, {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });

beforeAll(async () => {
  env.CRON_SECRET = SECRET;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

beforeEach(resetDatabase);

describe('POST /cron/cleanup', () => {
  test('rejects a missing or wrong secret', async () => {
    expect((await callCleanup()).status).toBe(401);
    expect((await callCleanup('Bearer wrong-secret')).status).toBe(401);
  });

  test('removes expired data once and can be called again safely', async () => {
    const account = await prisma.account.create({
      data: { email: 'member@example.com', passwordHash: 'hash', fullName: 'Member', memberProfile: { create: {} } },
    });
    const accountId = account.id;
    await prisma.refreshToken.createMany({
      data: [
        { accountId, tokenHash: 'old', expiresAt: daysAgo(31) },
        { accountId, tokenHash: 'revoked', expiresAt: daysAgo(-10), revokedAt: daysAgo(31) },
        { accountId, tokenHash: 'active', expiresAt: daysAgo(-10) },
      ],
    });
    await prisma.otpCode.createMany({
      data: [
        { email: account.email, purpose: 'REGISTER', codeHash: 'old', expiresAt: daysAgo(8) },
        { email: account.email, purpose: 'REGISTER', codeHash: 'new', expiresAt: daysAgo(1) },
      ],
    });
    await prisma.notification.createMany({
      data: [
        { accountId, type: 'SYSTEM', title: 'old', message: 'old', createdAt: daysAgo(91) },
        { accountId, type: 'SYSTEM', title: 'new', message: 'new', createdAt: daysAgo(89) },
      ],
    });
    await prisma.walletTopUp.create({
      data: { accountId, paymentCode: 'SCTUEXPIRED', amount: 100_000, expiresAt: daysAgo(1) },
    });

    const first = await callCleanup(`Bearer ${SECRET}`);
    const second = await callCleanup(`Bearer ${SECRET}`);

    expect(first.status).toBe(200);
    expect(((await first.json()) as { result: unknown }).result).toEqual({ processed: 5, remaining: 0 });
    expect(((await second.json()) as { result: unknown }).result).toEqual({ processed: 0, remaining: 0 });
    expect((await prisma.refreshToken.findMany()).map(({ tokenHash }) => tokenHash)).toEqual(['active']);
    expect((await prisma.otpCode.findMany()).map(({ codeHash }) => codeHash)).toEqual(['new']);
    expect((await prisma.notification.findMany()).map(({ title }) => title)).toEqual(['new']);
    expect((await prisma.walletTopUp.findFirst())?.status).toBe('EXPIRED');
  });
});
