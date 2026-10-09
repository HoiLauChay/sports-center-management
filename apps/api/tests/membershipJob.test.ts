import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import { addDays, formatDate, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

const SECRET = 'test-cron-secret-at-least-32-characters';

let server: Server;
let baseUrl: string;
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  env.CRON_SECRET = SECRET;
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}`;
  checkout = buildFetcher(`${baseUrl}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

type JobResult = Record<'renewed' | 'expired' | 'cancelled' | 'failed' | 'reminded' | 'remaining', number>;

const runJob = async () => {
  const response = await fetch(`${baseUrl}/api/v1/cron/memberships`, {
    method: 'POST',
    headers: { authorization: `Bearer ${SECRET}` },
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { result: JobResult }).result;
};

const seedMember = async (email: string, balance: number, data: { endDate?: string; cancelled?: boolean } = {}) => {
  const member = await createAccount('MEMBER', email);
  if (balance > 0) await seedBalance(member.id, balance);
  await giveActiveMembership(member.id, {}, data.endDate ?? todayInCenter());
  const membership = await prisma.memberMembership.findFirstOrThrow({ where: { accountId: member.id } });
  await prisma.memberMembership.update({
    where: { id: membership.id },
    data: {
      autoRenew: !data.cancelled,
      cancelledAt: data.cancelled ? new Date() : null,
    },
  });
  return { member, membership };
};

describe('membership job', () => {
  test('running the job twice renews once and settles cancelled or unpaid memberships', async () => {
    const renewing = await seedMember('renew@example.com', 600_000);
    const cancelled = await seedMember('cancelled@example.com', 600_000, { cancelled: true });
    const poor = await seedMember('poor@example.com', 0);

    const [first, second] = await Promise.all([runJob(), runJob()]);
    expect(first.renewed + second.renewed).toBe(1);
    expect(await runJob()).toMatchObject({ renewed: 0, expired: 0, cancelled: 0, remaining: 0 });

    const statuses = await prisma.memberMembership.findMany({
      where: { id: { in: [renewing.membership.id, cancelled.membership.id, poor.membership.id] } },
      select: { id: true, status: true, endDate: true },
    });
    const byId = new Map(statuses.map((row) => [row.id, row]));
    expect(byId.get(renewing.membership.id)).toMatchObject({ status: 'ACTIVE' });
    expect(formatDate(byId.get(renewing.membership.id)!.endDate)).toBe(addDays(todayInCenter(), 31));
    expect(byId.get(cancelled.membership.id)?.status).toBe('CANCELLED');
    expect(byId.get(poor.membership.id)?.status).toBe('EXPIRED');

    expect(await prisma.walletTransaction.count({ where: { type: 'PAYMENT' } })).toBe(1);
    expect(await expectWalletConsistent(renewing.member.id)).toBe(100_000);
    expect(await expectWalletConsistent(cancelled.member.id)).toBe(600_000);
    expect(
      await prisma.notification.count({ where: { accountId: poor.member.id, title: 'Gói thành viên đã hết hạn' } }),
    ).toBe(1);
  });

  test('a member buying while the job runs never ends up with two active memberships', async () => {
    const { member, membership } = await seedMember('member@example.com', 1_000_000);

    const [, bought] = await Promise.all([
      runJob(),
      checkout('POST', '/', member, {
        items: [{ type: 'MEMBERSHIP', packageId: membership.packageId }],
        paymentMethod: 'WALLET',
        expectedTotal: 500_000,
        idempotencyKey: 'buy-during-job',
      }),
    ]);
    expect(bought.status).toBe(201);

    expect(await prisma.memberMembership.count({ where: { accountId: member.id, status: 'ACTIVE' } })).toBe(1);
    const payments = await prisma.walletTransaction.count({ where: { accountId: member.id, type: 'PAYMENT' } });
    expect(await expectWalletConsistent(member.id)).toBe(1_000_000 - payments * 500_000);
  });

  test('members are reminded once before their membership ends', async () => {
    const { member } = await seedMember('soon@example.com', 0, { endDate: addDays(todayInCenter(), 3) });

    expect((await runJob()).reminded).toBe(1);
    expect((await runJob()).reminded).toBe(0);
    expect(
      await prisma.notification.count({ where: { accountId: member.id, title: 'Gói thành viên sắp hết hạn' } }),
    ).toBe(1);
  });
});
