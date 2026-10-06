import type { Coupon, Order, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { expectOrderConsistent } from './helpers/order';
import { seedFacility } from './helpers/schedule';
import { seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

const day = addDays(todayInCenter(), 2);
const hourAgo = () => new Date(Date.now() - 3_600_000).toISOString();
const nextWeek = () => new Date(Date.now() + 7 * 86_400_000).toISOString();

const line = (facilityId: string, startTime: string, endTime: string) => ({
  type: 'FACILITY_BOOKING',
  facilityId,
  date: day,
  startTime,
  endTime,
});

const couponBody = (overrides: Record<string, unknown> = {}) => ({
  code: ' sale10 ',
  name: 'Giảm 10%',
  discountType: 'PERCENT',
  discountValue: 10,
  validFrom: hourAgo(),
  validTo: nextWeek(),
  ...overrides,
});

beforeAll(async () => {
  ({ server, request } = await startServer('/coupons'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('coupon management', () => {
  test('codes are normalised and unique; updates keep untouched fields and stay consistent', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');

    expect((await request('GET', '/', member)).status).toBe(403);

    const created = await readResult<Coupon>(
      await request('POST', '/', manager, couponBody({ maxDiscount: 50_000, applicableTypes: ['FACILITY_BOOKING'] })),
    );
    expect(created).toMatchObject({ code: 'SALE10', maxUsesPerUser: 1, maxUses: null, usedCount: 0 });

    const duplicate = await request('POST', '/', manager, couponBody({ code: 'Sale10' }));
    expect(duplicate.status).toBe(409);

    const renamed = await readResult<Coupon>(await request('PATCH', `/${created.id}`, manager, { name: 'Mới' }));
    expect(renamed).toMatchObject({ name: 'Mới', maxDiscount: 50_000, applicableTypes: ['FACILITY_BOOKING'] });

    expect(await readCode(await request('PATCH', `/${created.id}`, manager, { discountValue: 150 }))).toBe(
      'VALIDATION_ERROR',
    );
    expect(
      await readCode(await request('PATCH', `/${created.id}`, manager, { validTo: '2020-01-01T00:00:00+07:00' })),
    ).toBe('VALIDATION_ERROR');

    expect((await request('DELETE', `/${created.id}`, manager)).status).toBe(200);
    expect(await readResult<Coupon[]>(await request('GET', '/', manager))).toEqual([]);
    expect((await request('POST', '/', manager, couponBody())).status).toBe(201);
  });
});

describe('coupon at checkout', () => {
  test('the discount is capped, split over eligible lines and limited per buyer', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 500_000);
    const court = await seedFacility(1);
    await request('POST', '/', manager, couponBody({ maxDiscount: 25_000, minOrderAmount: 300_000 }));
    await request('POST', '/', manager, couponBody({ code: 'LOP20', applicableTypes: ['COURSE_ENROLLMENT'] }));
    const items = [line(court.id, '08:00', '09:00'), line(court.id, '10:00', '12:00')];

    const small = await readResult<Quote>(
      await checkout('POST', '/quote', member, { items: items.slice(0, 1), couponCode: 'sale10' }),
    );
    expect(small.coupon).toMatchObject({ code: 'SALE10', valid: false });

    const other = await readResult<Quote>(await checkout('POST', '/quote', member, { items, couponCode: 'LOP20' }));
    expect(other.coupon).toMatchObject({ valid: false, discount: 0 });

    const quote = await readResult<Quote>(await checkout('POST', '/quote', member, { items, couponCode: 'SALE10' }));
    expect(quote.items.map(({ couponDiscount, total }) => ({ couponDiscount, total }))).toEqual([
      { couponDiscount: 8_333, total: 91_667 },
      { couponDiscount: 16_667, total: 183_333 },
    ]);
    expect(quote).toMatchObject({ coupon: { valid: true, discount: 25_000 }, total: 275_000, canCheckout: true });

    const paid = await checkout('POST', '/', member, {
      items,
      couponCode: 'SALE10',
      paymentMethod: 'WALLET',
      expectedTotal: 275_000,
      idempotencyKey: 'coupon-key-1',
    });
    expect(paid.status).toBe(201);
    const order = await readResult<Order>(paid);
    expect(order).toMatchObject({ coupon: { code: 'SALE10', discount: 25_000 }, totalAmount: 275_000 });
    await expectOrderConsistent(order.id);

    const again = await readResult<Quote>(
      await checkout('POST', '/quote', member, {
        items: [line(court.id, '13:00', '16:00')],
        couponCode: 'SALE10',
      }),
    );
    expect(again.coupon).toMatchObject({ valid: false, error: 'Người mua đã dùng hết lượt của mã này' });
  });

  test('two orders racing for the last use: only one gets the discount', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const members = await Promise.all(
      ['a@example.com', 'b@example.com'].map((email) => createAccount('MEMBER', email)),
    );
    await Promise.all(members.map(({ id }) => seedBalance(id, 100_000)));
    const courts = [await seedFacility(1), await seedFacility(1)];
    await request('POST', '/', manager, couponBody({ maxUses: 1 }));

    const responses = await Promise.all(
      members.map((member, index) =>
        checkout('POST', '/', member, {
          items: [line(courts[index]!.id, '18:00', '19:00')],
          couponCode: 'SALE10',
          paymentMethod: 'WALLET',
          expectedTotal: 90_000,
          idempotencyKey: `coupon-race-${index}`,
        }),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(await readCode(responses.find(({ status }) => status === 409)!)).toBe('COUPON_INVALID');
    expect(await prisma.order.count({ where: { coupon: { code: 'SALE10' } } })).toBe(1);
  });
});
