import type { Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { lineHandlers } from '~/services/checkout/lines';
import type { AnyLineHandler } from '~/services/checkout/types';
import { percentOf } from '~/utils/money';
import { todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

const unused = () => Promise.reject(new Error('not used by quote'));

const fakeHandler = (
  type: AnyLineHandler['type'],
  guestAllowed: boolean,
  price: AnyLineHandler['prepare'],
): AnyLineHandler => ({
  type,
  guestAllowed,
  needsScheduleLock: false,
  lockTargets: () => ({}),
  prepare: price,
  verify: unused,
  fulfill: unused,
});

beforeAll(async () => {
  ({ server, request } = await startServer('/checkout'));
  lineHandlers.MEMBERSHIP = fakeHandler('MEMBERSHIP', false, async () => ({
    ok: true,
    subtotal: 500_000,
    membershipDiscount: 0,
    snapshot: { packageName: 'Gold' },
    data: null,
  }));
  lineHandlers.FACILITY_BOOKING = fakeHandler('FACILITY_BOOKING', true, async (_db, ctx) => ({
    ok: true,
    subtotal: 200_000,
    membershipDiscount: percentOf(200_000, ctx.benefits?.current?.bookingDiscountPct ?? 0),
    snapshot: { facilityName: 'Sân 1' },
    data: null,
  }));
});

afterAll(() => {
  delete lineHandlers.MEMBERSHIP;
  delete lineHandlers.FACILITY_BOOKING;
  server.close();
});

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const membership = { type: 'MEMBERSHIP', packageId: '00000000-0000-4000-8000-000000000001' };
const booking = {
  type: 'FACILITY_BOOKING',
  facilityId: '00000000-0000-4000-8000-000000000002',
  date: '2026-10-05',
  startTime: '18:00',
  endTime: '19:00',
};

const giveActiveMembership = async (accountId: string, bookingDiscountPct: number) => {
  const today = new Date(`${todayInCenter()}T00:00:00Z`);
  const end = new Date(today.getTime() + 30 * 86_400_000);
  const gold = await prisma.membership.create({
    data: {
      name: 'Gold',
      price: 500_000,
      durationDays: 30,
      gymAccess: true,
      bookingDiscountPct,
      classDiscountPct: 10,
      freeBookingSlotsPerMonth: 4,
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: 'DH260901TEST01',
      idempotencyKey: `test:${accountId}`,
      accountId,
      receiptSnapshot: { schema_version: 1 },
      subtotal: 500_000,
      totalAmount: 500_000,
      paymentMethod: 'WALLET',
      items: {
        create: {
          lineNumber: 1,
          type: 'MEMBERSHIP',
          itemSnapshot: { schema_version: 1 },
          subtotal: 500_000,
          totalAmount: 500_000,
        },
      },
    },
    include: { items: true },
  });
  await prisma.memberMembership.create({
    data: {
      accountId,
      packageId: gold.id,
      startDate: today,
      endDate: end,
      periods: {
        create: {
          orderItemId: order.items[0]!.id,
          periodStart: today,
          periodEnd: end,
          gymAccess: true,
          bookingDiscountPct,
          classDiscountPct: 10,
          freeBookingSlotsPerMonth: 4,
        },
      },
    },
  });
};

describe('checkout quote', () => {
  test('a membership bought in the same order does not discount the other lines', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');

    const quote = await readResult<Quote>(await request('POST', '/quote', member, { items: [membership, booking] }));

    expect(
      quote.items.map(({ lineNumber, valid, membershipDiscount }) => ({ lineNumber, valid, membershipDiscount })),
    ).toEqual([
      { lineNumber: 1, valid: true, membershipDiscount: 0 },
      { lineNumber: 2, valid: true, membershipDiscount: 0 },
    ]);
    expect(quote).toMatchObject({
      subtotal: 700_000,
      membershipDiscount: 0,
      total: 700_000,
      walletBalance: 0,
      canCheckout: true,
    });
  });

  test('totals add up the valid lines only and any invalid line blocks checkout', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await giveActiveMembership(member.id, 20);

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [booking, membership, membership] }),
    );

    expect(quote.items.map(({ valid, total, error }) => ({ valid, total, code: error?.code }))).toEqual([
      { valid: true, total: 160_000, code: undefined },
      { valid: true, total: 500_000, code: undefined },
      { valid: false, total: 0, code: 'MEMBERSHIP_LINE_LIMIT' },
    ]);
    expect(quote).toMatchObject({ subtotal: 700_000, membershipDiscount: 40_000, total: 660_000, canCheckout: false });
    expect(quote.total).toBe(quote.items.reduce((sum, { total }) => sum + total, 0));
  });

  test('receptionist must name the buyer; guests, unsupported lines and coupons are rejected per line', async () => {
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');

    expect(await readCode(await request('POST', '/quote', receptionist, { items: [booking] }))).toBe(
      'VALIDATION_ERROR',
    );

    const quote = await readResult<Quote>(
      await request('POST', '/quote', receptionist, {
        buyer: { guest: { name: 'Khách A', phone: '0901234567' } },
        items: [booking, membership, { type: 'COURSE_ENROLLMENT', classId: '00000000-0000-4000-8000-000000000003' }],
        couponCode: 'welcome20',
      }),
    );

    expect(quote.items.map(({ valid, error }) => (valid ? null : error?.code))).toEqual([
      null,
      'GUEST_NOT_ALLOWED',
      'LINE_TYPE_UNSUPPORTED',
    ]);
    expect(quote.coupon).toMatchObject({ code: 'WELCOME20', valid: false });
    expect(quote).toMatchObject({ total: 200_000, walletBalance: null, canCheckout: false });
  });
});
