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
  test('the package in use cannot be bought again, even after cancelling, while the counter can switch it', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'desk@example.com');
    await seedBalance(member.id, 1_000_000);
    await giveActiveMembership(member.id);
    const current = await prisma.memberMembership.update({
      where: { accountId: member.id, status: 'ACTIVE' },
      data: { cancelledAt: new Date(), autoRenew: false },
    });

    const same = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [{ type: 'MEMBERSHIP', packageId: current.packageId }] }),
    );
    expect(same.items[0]).toMatchObject({ valid: false, error: { code: 'INVALID_STATE' } });

    const atDesk = await readResult<Quote>(
      await request('POST', '/quote', receptionist, {
        buyer: { accountId: member.id },
        items: [{ type: 'MEMBERSHIP', packageId: current.packageId }],
      }),
    );
    expect(atDesk.items[0]).toMatchObject({ valid: false, error: { code: 'INVALID_STATE' } });

    const other = await prisma.membership.create({ data: { name: 'Silver', price: 200_000, durationDays: 30 } });
    const counter = await request('POST', '/', receptionist, {
      buyer: { accountId: member.id },
      items: [{ type: 'MEMBERSHIP', packageId: other.id }],
      paymentMethod: 'CASH',
      expectedTotal: 200_000,
      idempotencyKey: 'desk-membership-1',
    });
    expect(counter.status).toBe(201);
    expect(await prisma.memberMembership.findUniqueOrThrow({ where: { id: current.id } })).toMatchObject({
      status: 'CANCELLED',
    });
    const active = await prisma.memberMembership.findMany({ where: { accountId: member.id, status: 'ACTIVE' } });
    expect(active.map(({ packageId }) => packageId)).toEqual([other.id]);
    expect(await expectWalletConsistent(member.id)).toBe(1_000_000);
  });

  test('switching ends the current package today, keeps its paid period and gives the new benefits at once', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const court = await seedFacility(1);
    await seedBalance(member.id, 1_000_000);
    await giveActiveMembership(member.id, { bookingDiscountPct: 10 });
    const before = await prisma.memberMembership.findFirstOrThrow({ include: { periods: true } });
    const silver = await prisma.membership.create({
      data: { name: 'Silver', price: 300_000, durationDays: 30, bookingDiscountPct: 20 },
    });

    const order = await buy(member, silver.id, 300_000);
    await expectOrderConsistent(order.id);

    const today = todayInCenter();
    const old = await prisma.memberMembership.findUniqueOrThrow({
      where: { id: before.id },
      include: { periods: true },
    });
    expect(old).toMatchObject({ status: 'CANCELLED', autoRenew: false });
    expect(old.cancelledAt).not.toBeNull();
    expect(formatDate(old.endDate)).toBe(today);
    expect(old.periods).toEqual(before.periods);

    const next = await prisma.memberMembership.findUniqueOrThrow({ where: { id: order.items[0]!.refId! } });
    expect(next).toMatchObject({ packageId: silver.id, status: 'ACTIVE', autoRenew: true, cancelledAt: null });
    expect([formatDate(next.startDate), formatDate(next.endDate)]).toEqual([today, addDays(today, 30)]);
    expect(await expectWalletConsistent(member.id)).toBe(700_000);

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, {
        items: [
          {
            type: 'FACILITY_BOOKING',
            facilityId: court.id,
            date: addDays(today, 1),
            startTime: '08:00',
            endTime: '09:00',
          },
        ],
      }),
    );
    expect(quote.total).toBe(80_000);
  });

  test('a package bought today can be switched the same day', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 1_000_000);
    const gold = await prisma.membership.create({ data: { name: 'Gold', price: 500_000, durationDays: 30 } });
    const silver = await prisma.membership.create({ data: { name: 'Silver', price: 300_000, durationDays: 30 } });

    const first = await buy(member, gold.id, 500_000);
    await buy(member, silver.id, 300_000);

    const today = todayInCenter();
    const old = await prisma.memberMembership.findUniqueOrThrow({ where: { id: first.items[0]!.refId! } });
    expect(old.status).toBe('CANCELLED');
    expect([formatDate(old.startDate), formatDate(old.endDate)]).toEqual([today, today]);
    expect(await prisma.memberMembership.count({ where: { accountId: member.id, status: 'ACTIVE' } })).toBe(1);
    expect(await expectWalletConsistent(member.id)).toBe(200_000);
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
    expect(rows.map(({ status, autoRenew }) => [status, autoRenew])).toEqual([
      ['EXPIRED', false],
      ['ACTIVE', true],
    ]);
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
