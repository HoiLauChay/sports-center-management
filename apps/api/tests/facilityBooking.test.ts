import type { Order, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { expectOrderConsistent } from './helpers/order';
import { seedFacility, seedSession } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

const day = addDays(todayInCenter(), 2);

const line = (facilityId: string, startTime: string, endTime: string, date = day) => ({
  type: 'FACILITY_BOOKING',
  facilityId,
  date,
  startTime,
  endTime,
});

const summary = (quote: Quote) =>
  quote.items.map(({ valid, total, snapshot, error }) => ({
    valid,
    total,
    benefit: snapshot?.benefit,
    code: error?.code,
  }));

beforeAll(async () => {
  ({ server, request } = await startServer('/checkout'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('facility booking line', () => {
  test('two members racing for the last slot: only one gets it', async () => {
    const court = await seedFacility(1);
    const members = await Promise.all(
      ['a@example.com', 'b@example.com'].map((email) => createAccount('MEMBER', email)),
    );
    await Promise.all(members.map(({ id }) => seedBalance(id, 100_000)));

    const responses = await Promise.all(
      members.map((member, index) =>
        request('POST', '/', member, {
          items: [line(court.id, '18:00', '19:00')],
          paymentMethod: 'WALLET',
          expectedTotal: 100_000,
          idempotencyKey: `race-key-${index}`,
        }),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const lost = responses.find(({ status }) => status === 409)!;
    expect(await readCode(lost)).toBe('CART_ITEM_INVALID');
    expect(await prisma.facilityBooking.count()).toBe(1);
    const balances = await Promise.all(members.map(({ id }) => expectWalletConsistent(id)));
    expect(balances.sort()).toEqual([0, 100_000]);
  });

  test('free slots cover whole bookings until the monthly quota runs out, then the discount applies', async () => {
    const court = await seedFacility(1);
    const member = await createAccount('MEMBER', 'member@example.com');
    await giveActiveMembership(member.id, { freeBookingSlotsPerMonth: 2, bookingDiscountPct: 20 });

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, {
        items: [line(court.id, '08:00', '10:00'), line(court.id, '18:00', '19:00')],
      }),
    );
    expect(summary(quote)).toEqual([
      { valid: true, total: 0, benefit: 'FREE_SLOT', code: undefined },
      { valid: true, total: 80_000, benefit: 'DISCOUNT', code: undefined },
    ]);

    const paid = await request('POST', '/', member, {
      items: [line(court.id, '08:00', '10:00')],
      paymentMethod: 'WALLET',
      expectedTotal: 0,
      idempotencyKey: 'free-slot-key',
    });
    expect(paid.status).toBe(201);
    const order = await readResult<Order>(paid);
    await expectOrderConsistent(order.id);
    expect(await prisma.facilityBooking.findFirst({ select: { id: true, benefit: true, unitPrice: true } })).toEqual({
      id: order.items[0]!.refId!,
      benefit: 'FREE_SLOT',
      unitPrice: expect.anything(),
    });

    const after = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [line(court.id, '11:00', '12:00')] }),
    );
    expect(summary(after)).toEqual([{ valid: true, total: 80_000, benefit: 'DISCOUNT', code: undefined }]);
  });

  test('a member with gym access books the gym for free without using the quota', async () => {
    const gym = await seedFacility(20, { type: 'GYM', pricePerSlot: 50_000 });
    const court = await seedFacility(1);
    const member = await createAccount('MEMBER', 'member@example.com');
    await giveActiveMembership(member.id, { gymAccess: true, freeBookingSlotsPerMonth: 1 });

    const paid = await request('POST', '/', member, {
      items: [line(gym.id, '06:00', '07:00')],
      paymentMethod: 'WALLET',
      expectedTotal: 0,
      idempotencyKey: 'gym-booking-key',
    });
    expect(paid.status).toBe(201);
    expect((await prisma.facilityBooking.findFirstOrThrow()).benefit).toBe('GYM_ACCESS');

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [line(court.id, '07:00', '08:00')] }),
    );
    expect(summary(quote)).toEqual([{ valid: true, total: 0, benefit: 'FREE_SLOT', code: undefined }]);
  });

  test('clashes inside the order, class sessions and the advance limit invalidate the line', async () => {
    const [courtA, courtB] = [await seedFacility(1), await seedFacility(1)];
    await seedSession(courtB.id, '10:00', '12:00', { date: day });
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, {
        items: [
          line(courtA.id, '18:00', '19:00'),
          line(courtB.id, '18:00', '20:00'),
          line(courtB.id, '11:00', '12:00'),
          line(courtA.id, '18:00', '19:00', addDays(todayInCenter(), 8)),
        ],
      }),
    );
    expect(summary(quote).map(({ valid, code }) => ({ valid, code }))).toEqual([
      { valid: true, code: undefined },
      { valid: false, code: 'SCHEDULE_CONFLICT' },
      { valid: false, code: 'SCHEDULE_CONFLICT' },
      { valid: false, code: 'VALIDATION_ERROR' },
    ]);

    const guest = await readResult<Quote>(
      await request('POST', '/quote', receptionist, {
        buyer: { guest: { name: 'Khách A', phone: '0901234567' } },
        items: [line(courtA.id, '18:00', '19:00')],
      }),
    );
    expect(summary(guest)).toEqual([{ valid: true, total: 100_000, benefit: 'NONE', code: undefined }]);
  });
});
