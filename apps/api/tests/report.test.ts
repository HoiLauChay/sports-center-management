import type { Order, OverviewReport, RevenueReport, WalletReport } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { seedFacility } from './helpers/schedule';
import { seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;
let enrollments: ReturnType<typeof buildFetcher>;

const today = todayInCenter();

beforeAll(async () => {
  ({ server, request } = await startServer('/reports'));
  const base = `http://localhost:${(server.address() as { port: number }).port}/api/v1`;
  checkout = buildFetcher(`${base}/checkout`);
  enrollments = buildFetcher(`${base}/enrollments`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const seedSales = async () => {
  const court = await seedFacility(1);
  const cls = await seedOpenClass();
  const member = await createAccount('MEMBER', 'member@example.com');
  const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
  await seedBalance(member.id, 500_000);
  const booking = (startTime: string, endTime: string) => ({
    type: 'FACILITY_BOOKING',
    facilityId: court.id,
    date: addDays(today, 1),
    startTime,
    endTime,
  });

  const bought = await readResult<Order>(
    await checkout('POST', '/', member, {
      items: [booking('08:00', '09:00'), { type: 'COURSE_ENROLLMENT', classId: cls.id }],
      paymentMethod: 'WALLET',
      expectedTotal: 400_000,
      idempotencyKey: 'report-wallet-order',
    }),
  );
  expect(
    (
      await checkout('POST', '/', receptionist, {
        buyer: { guest: { name: 'Khách A', phone: '0901234567' } },
        items: [booking('10:00', '11:00')],
        paymentMethod: 'CASH',
        expectedTotal: 100_000,
        idempotencyKey: 'report-cash-order',
      })
    ).status,
  ).toBe(201);
  expect((await enrollments('POST', `/${bought.items[1]!.refId}/cancel`, member)).status).toBe(200);
};

describe('reports', () => {
  test('revenue by type and by payment method add up to the revenue, refunds counted when made', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await seedSales();

    const { buckets } = await readResult<RevenueReport>(
      await request('GET', `/revenue?from=${addDays(today, -2)}&to=${today}`, manager),
    );
    expect(buckets.map(({ period }) => period)).toEqual([addDays(today, -2), addDays(today, -1), today]);
    const day = buckets.at(-1)!;
    expect(day).toMatchObject({ revenue: 500_000, refunds: 300_000, net: 200_000 });
    expect(Object.values(day.byType).reduce((sum, value) => sum + value, 0)).toBe(day.revenue);
    expect(day.byType).toMatchObject({ FACILITY_BOOKING: 200_000, COURSE_ENROLLMENT: 300_000 });
    expect(day.byPaymentMethod).toMatchObject({ WALLET: 400_000, CASH: 100_000 });

    const overview = await readResult<OverviewReport>(await request('GET', '/overview', manager));
    expect(overview).toMatchObject({ revenueToday: 500_000, newMembersToday: 1, unmatchedBankTransactions: 0 });
  });

  test('the wallet change is top-ups minus payments plus refunds and matches the balances', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await seedSales();

    const report = await readResult<WalletReport>(
      await request('GET', `/wallet?from=${today}&to=${today}&granularity=month`, manager),
    );
    expect(report.buckets).toEqual([
      {
        period: today.slice(0, 7),
        topUpBankTransfer: 0,
        topUpCounter: { CASH: 500_000, CARD: 0 },
        payments: 400_000,
        refunds: 300_000,
        netChange: 400_000,
      },
    ]);
    expect(report.totalBalance).toBe(report.buckets[0]!.netChange);

    expect(await readCode(await request('GET', `/wallet?from=${today}&to=${addDays(today, -1)}`, manager))).toBe(
      'VALIDATION_ERROR',
    );
  });
});
