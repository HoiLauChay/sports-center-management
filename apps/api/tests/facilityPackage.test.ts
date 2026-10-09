import type { FacilityPackagePreview, Order } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { expectOrderConsistent } from './helpers/order';
import { seedBooking, seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

beforeAll(async () => {
  ({ server, request } = await startServer('/facility-packages'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('facility package line', () => {
  test('one clashing session invalidates the whole package and nothing is booked', async () => {
    const court = await seedFacility(1);
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 1_000_000);
    const startDate = addDays(todayInCenter(), 1);
    await seedBooking(court.id, '18:00', '19:00', { date: addDays(startDate, 7) });
    const weekly = {
      facilityId: court.id,
      startDate,
      daysOfWeek: [dayOfWeek(startDate)],
      startTime: '18:00',
      endTime: '19:00',
      weeks: 3,
    };

    const preview = await readResult<FacilityPackagePreview>(await request('POST', '/preview', member, weekly));
    expect(preview.bookings.map(({ available, conflict }) => ({ available, conflict }))).toEqual([
      { available: true, conflict: undefined },
      { available: false, conflict: 'BOOKED' },
      { available: true, conflict: undefined },
    ]);
    expect(preview).toMatchObject({ isValid: false, unitPrice: 100_000, basePrice: 300_000 });

    const paid = await checkout('POST', '/', member, {
      items: [{ type: 'FACILITY_PACKAGE', ...weekly }],
      paymentMethod: 'WALLET',
      expectedTotal: 300_000,
      idempotencyKey: 'package-clash-1',
    });
    expect(await readCode(paid)).toBe('CART_ITEM_INVALID');
    expect(await prisma.facilityBooking.count()).toBe(1);
    expect(await prisma.facilityPackage.count()).toBe(0);
    expect(await expectWalletConsistent(member.id)).toBe(1_000_000);
  });

  test('the line price is the sum of its bookings after free slots and discounts', async () => {
    const court = await seedFacility(1);
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 500_000);
    await giveActiveMembership(member.id, { freeBookingSlotsPerMonth: 1, bookingDiscountPct: 10 });
    let startDate = addDays(todayInCenter(), 1);
    if (startDate.slice(0, 7) !== addDays(startDate, 1).slice(0, 7)) startDate = addDays(startDate, 1);
    const nextDay = addDays(startDate, 1);

    const response = await checkout('POST', '/', member, {
      items: [
        {
          type: 'FACILITY_PACKAGE',
          facilityId: court.id,
          startDate,
          daysOfWeek: [dayOfWeek(startDate), dayOfWeek(nextDay)],
          startTime: '08:00',
          endTime: '09:00',
          weeks: 1,
        },
      ],
      paymentMethod: 'WALLET',
      expectedTotal: 90_000,
      idempotencyKey: 'package-price-1',
    });
    expect(response.status).toBe(201);
    const order = await readResult<Order>(response);
    expect(order.items[0]).toMatchObject({ subtotal: 200_000, membershipDiscount: 110_000, totalAmount: 90_000 });
    expect(order.items[0]!.snapshot).toMatchObject({ sessions: 2, freeSessions: 1, startDate, endDate: nextDay });
    await expectOrderConsistent(order.id);

    const facilityPackage = await prisma.facilityPackage.findUniqueOrThrow({
      where: { id: order.items[0]!.refId! },
      include: { bookings: { orderBy: { bookingDate: 'asc' } } },
    });
    expect(facilityPackage.bookings.map(({ benefit }) => benefit)).toEqual(['FREE_SLOT', 'DISCOUNT']);
    expect(await expectWalletConsistent(member.id)).toBe(410_000);
  });

  test('a receptionist previews for the named member and sees the sessions that member already has', async () => {
    const [court, otherCourt] = await Promise.all([seedFacility(2), seedFacility(2)]);
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
    const startDate = addDays(todayInCenter(), 1);
    await seedBooking(otherCourt.id, '18:00', '19:00', { date: startDate, accountId: member.id });
    const weekly = {
      facilityId: court.id,
      startDate,
      daysOfWeek: [dayOfWeek(startDate)],
      startTime: '18:00',
      endTime: '19:00',
      weeks: 2,
    };

    const preview = await readResult<FacilityPackagePreview>(
      await request('POST', '/preview', receptionist, { ...weekly, buyer: { accountId: member.id } }),
    );
    expect(preview.bookings.map(({ available }) => available)).toEqual([false, true]);
    expect(preview.isValid).toBe(false);
    expect((await request('POST', '/preview', receptionist, weekly)).status).toBe(422);
  });
});
