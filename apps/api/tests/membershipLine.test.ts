import type { Order, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, formatDate, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer, type Viewer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { expectOrderConsistent } from './helpers/order';
import { seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/checkout'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const buy = async (member: Viewer, packageId: string, expectedTotal: number) => {
  const response = await request('POST', '/', member, {
    items: [{ type: 'MEMBERSHIP', packageId }],
    paymentMethod: 'WALLET',
    expectedTotal,
    idempotencyKey: `membership-${crypto.randomUUID()}`,
  });
  expect(response.status).toBe(201);
  return readResult<Order>(response);
};

describe('membership line', () => {
  test('renewing early extends the end date and keeps the earlier period untouched', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 1_000_000);
    await giveActiveMembership(member.id, { bookingDiscountPct: 10 });
    const before = await prisma.memberMembership.findFirstOrThrow({ include: { periods: true } });
    const oldEnd = formatDate(before.endDate);

    const order = await buy(member, before.packageId, 500_000);
    await expectOrderConsistent(order.id);
    expect(order.items[0]).toMatchObject({ refId: before.id, totalAmount: 500_000 });

    const after = await prisma.memberMembership.findUniqueOrThrow({
      where: { id: before.id },
      include: { periods: { orderBy: { periodStart: 'asc' } } },
    });
    expect(formatDate(after.endDate)).toBe(addDays(oldEnd, 31));
    expect(after.periods.map(({ periodStart, periodEnd }) => [formatDate(periodStart), formatDate(periodEnd)])).toEqual(
      [
        [formatDate(before.periods[0]!.periodStart), oldEnd],
        [oldEnd, addDays(oldEnd, 31)],
      ],
    );
    expect(await expectWalletConsistent(member.id)).toBe(500_000);

    const other = await prisma.membership.create({ data: { name: 'Silver', price: 200_000, durationDays: 30 } });
    const switched = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [{ type: 'MEMBERSHIP', packageId: other.id }] }),
    );
    expect(switched.items[0]).toMatchObject({ valid: false, error: { code: 'INVALID_STATE' } });
  });

  test('an expired membership is closed first, and later package edits never change a paid period', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const court = await seedFacility(1);
    await seedBalance(member.id, 500_000);
    await giveActiveMembership(member.id);
    const lapsed = await prisma.memberMembership.update({
      where: { accountId: member.id, status: 'ACTIVE' },
      data: { endDate: new Date(todayInCenter()) },
    });
    await prisma.membership.update({ where: { id: lapsed.packageId }, data: { bookingDiscountPct: 10 } });

    await buy(member, lapsed.packageId, 500_000);
    await prisma.membership.update({ where: { id: lapsed.packageId }, data: { bookingDiscountPct: 50 } });

    const rows = await prisma.memberMembership.findMany({ orderBy: { createdAt: 'asc' }, include: { periods: true } });
    expect(rows.map(({ status }) => status)).toEqual(['EXPIRED', 'ACTIVE']);
    expect(formatDate(rows[1]!.startDate)).toBe(todayInCenter());
    expect(rows[1]!.periods[0]!.bookingDiscountPct).toBe(10);

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, {
        items: [
          {
            type: 'FACILITY_BOOKING',
            facilityId: court.id,
            date: addDays(todayInCenter(), 1),
            startTime: '08:00',
            endTime: '09:00',
          },
        ],
      }),
    );
    expect(quote.total).toBe(90_000);
  });
});
