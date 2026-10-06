import type { Order, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { lineHandlers } from '~/services/checkout/lines';
import type { AnyLineHandler } from '~/services/checkout/types';
import { percentOf } from '~/utils/money';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { expectOrderConsistent } from './helpers/order';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

let bookingPrice = 200_000;
const realBookingHandler = lineHandlers.FACILITY_BOOKING;

const unused = () => Promise.reject(new Error('not used by checkout'));

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
  fulfill: async () => ({ refId: crypto.randomUUID() }),
});

beforeAll(async () => {
  ({ server, request } = await startServer('/checkout'));
  lineHandlers.FACILITY_PACKAGE = packageHandler;
  lineHandlers.MEMBERSHIP = fakeHandler('MEMBERSHIP', false, async () => ({
    ok: true,
    subtotal: 500_000,
    membershipDiscount: 0,
    snapshot: { title: 'Gói Gold', startAt: '2026-10-03', endAt: '2026-11-02', discountPct: 0 },
    data: null,
  }));
  lineHandlers.FACILITY_BOOKING = fakeHandler('FACILITY_BOOKING', true, async (db, ctx, input) => {
    const discountPct = ctx.benefits?.current?.bookingDiscountPct ?? 0;
    const facility = 'facilityId' in input ? await db.facility.findUnique({ where: { id: input.facilityId } }) : null;
    return {
      ok: true,
      subtotal: bookingPrice,
      membershipDiscount: percentOf(bookingPrice, discountPct),
      snapshot: {
        title: facility?.name ?? 'Sân 1',
        startAt: '2026-10-05T11:00:00.000Z',
        endAt: '2026-10-05T12:00:00.000Z',
        discountPct,
      },
      data: null,
    };
  });
});

const packageHandler = fakeHandler('FACILITY_PACKAGE', false, async () => ({
  ok: true,
  subtotal: 100_000,
  membershipDiscount: 0,
  snapshot: { title: 'Sân 1 · T2, T4, T6', startAt: '2026-10-05', endAt: '2026-10-10', discountPct: 0 },
  data: null,
}));

afterAll(() => {
  delete lineHandlers.FACILITY_PACKAGE;
  delete lineHandlers.MEMBERSHIP;
  lineHandlers.FACILITY_BOOKING = realBookingHandler;
  server.close();
});

beforeEach(async () => {
  bookingPrice = 200_000;
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

const weekly = {
  type: 'FACILITY_PACKAGE',
  facilityId: '00000000-0000-4000-8000-000000000002',
  startDate: '2026-10-05',
  daysOfWeek: [1, 3, 5],
  startTime: '18:00',
  endTime: '19:00',
  weeks: 1,
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
    await giveActiveMembership(member.id, { bookingDiscountPct: 20 });

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

const pay = (key: string, overrides: Record<string, unknown> = {}) => ({
  items: [booking],
  paymentMethod: 'WALLET',
  expectedTotal: 200_000,
  idempotencyKey: key,
  ...overrides,
});

describe('checkout', () => {
  test('resending the same idempotency key returns the same order and charges once', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 400_000);
    const body = pay('order-key-1', { items: [booking, weekly], expectedTotal: 300_000 });

    const responses = await Promise.all([1, 2, 3].map(() => request('POST', '/', member, body)));
    expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
    const orders = await Promise.all(responses.map((response) => readResult<Order>(response)));
    expect(new Set(orders.map(({ id }) => id)).size).toBe(1);
    expect(orders[0]).toMatchObject({ status: 'PAID', paymentMethod: 'WALLET', totalAmount: 300_000, createdBy: null });

    expect(await prisma.order.count()).toBe(1);
    expect(await prisma.walletTransaction.count({ where: { type: 'PAYMENT' } })).toBe(1);
    expect(await expectWalletConsistent(member.id)).toBe(100_000);
    await expectOrderConsistent(orders[0]!.id);

    const conflict = await request('POST', '/', member, { ...body, expectedTotal: 280_000 });
    expect(conflict.status).toBe(409);
    expect(await readCode(conflict)).toBe('IDEMPOTENCY_CONFLICT');
  });

  test('a changed price or an insufficient wallet rejects the order and leaves the balance untouched', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 100_000);

    const changed = await request('POST', '/', member, pay('order-key-2', { expectedTotal: 150_000 }));
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({ code: 'PRICE_CHANGED', quote: { total: 200_000 } });

    const poor = await request('POST', '/', member, pay('order-key-3'));
    expect(poor.status).toBe(409);
    expect(await readCode(poor)).toBe('INSUFFICIENT_BALANCE');

    expect(await prisma.order.count()).toBe(0);
    expect(await expectWalletConsistent(member.id)).toBe(100_000);
  });

  test('a free order succeeds without a wallet transaction; the counter takes cash for guests', async () => {
    bookingPrice = 0;
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');

    const free = await request('POST', '/', member, pay('order-key-4', { expectedTotal: 0 }));
    expect(free.status).toBe(201);
    expect(await readResult<Order>(free)).toMatchObject({ totalAmount: 0, status: 'PAID' });
    expect(await prisma.walletTransaction.count()).toBe(0);

    expect(
      await readCode(
        await request('POST', '/', member, pay('order-key-5', { paymentMethod: 'CASH', expectedTotal: 0 })),
      ),
    ).toBe('VALIDATION_ERROR');

    bookingPrice = 200_000;
    const counter = await request(
      'POST',
      '/',
      receptionist,
      pay('order-key-6', { paymentMethod: 'CASH', buyer: { guest: { name: 'Khách A', phone: '0901234567' } } }),
    );
    expect(counter.status).toBe(201);
    expect(await readResult<Order>(counter)).toMatchObject({
      account: null,
      guestName: 'Khách A',
      createdBy: { id: receptionist.id },
      paymentMethod: 'CASH',
      totalAmount: 200_000,
    });
  });
});
