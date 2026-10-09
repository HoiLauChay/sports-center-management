import type { Booking, FacilityPackage, Paginated } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility } from './helpers/schedule';
import { seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
beforeAll(async () => {
  ({ server, request } = await startServer(''));
});
afterAll(() => server.close());
beforeEach(resetDatabase);

describe('booking views', () => {
  test('member list and detail isolate ownership, include history, and map date/time/money', async () => {
    const member = await createAccount('MEMBER', 'owner@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const court = await seedFacility(4);
    const first = await seedBooking(court.id, '08:00', '09:00', { accountId: member.id, date: '2026-10-20' });
    const second = await seedBooking(court.id, '09:00', '10:00', { accountId: member.id, date: '2026-10-21' });
    await prisma.facilityBooking.update({ where: { id: second.id }, data: { status: 'CANCELLED' } });
    const foreign = await seedBooking(court.id, '08:00', '09:00', { accountId: other.id });
    const guest = await seedBooking(court.id, '10:00', '11:00');
    const list = await readResult<Paginated<Booking>>(await request('GET', '/me/bookings?limit=1', member));
    expect(list).toMatchObject({ total: 2, page: 1, limit: 1 });
    expect(list.items[0]?.id).toBe(second.id);
    expect(
      (await readResult<Paginated<Booking>>(await request('GET', '/me/bookings?page=2&limit=1', member))).items[0]?.id,
    ).toBe(first.id);
    const filtered = await readResult<Paginated<Booking>>(
      await request('GET', '/me/bookings?from=2026-10-20&to=2026-10-20&status=CONFIRMED', member),
    );
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]).toMatchObject({
      id: first.id,
      date: '2026-10-20',
      startTime: '08:00',
      endTime: '09:00',
      paidAmount: 0,
      packageId: null,
      account: { id: member.id },
      guestPhone: null,
    });
    expect(filtered.items[0]).not.toHaveProperty('orderItem');
    expect((await request('GET', `/bookings/${first.id}`, member)).status).toBe(200);
    for (const id of [foreign.id, guest.id, crypto.randomUUID()])
      expect((await request('GET', `/bookings/${id}`, member)).status).toBe(404);
    expect((await request('GET', '/bookings', member)).status).toBe(403);
    const isolated = await readResult<Paginated<Booking>>(
      await request('GET', `/me/bookings?accountId=${other.id}`, member),
    );
    expect(isolated.items.every((b) => b.account?.id === member.id)).toBe(true);
  });

  test('staff combines all filters, supports guests and validates invalid queries', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const court = await seedFacility(4);
    const guest = await seedBooking(court.id, '08:00', '09:00');
    await seedBooking(court.id, '10:00', '11:00', { accountId: member.id });
    const query = `facilityId=${court.id}&guestPhone=0901234567&date=2026-10-20&from=2026-10-20&to=2026-10-20&status=CONFIRMED`;
    for (const staff of [manager, receptionist]) {
      const page = await readResult<Paginated<Booking>>(await request('GET', `/bookings?${query}`, staff));
      expect(page.total).toBe(1);
      expect(page.items[0]).toMatchObject({
        id: guest.id,
        account: null,
        guestName: 'Khách',
        guestPhone: '0901234567',
      });
      expect((await request('GET', `/bookings/${guest.id}`, staff)).status).toBe(200);
      expect(
        (await readResult<Paginated<Booking>>(await request('GET', `/bookings?accountId=${member.id}`, staff))).total,
      ).toBe(1);
      expect(
        (await readResult<Paginated<Booking>>(await request('GET', `/bookings?${query}&accountId=${member.id}`, staff)))
          .total,
      ).toBe(0);
      expect(
        (
          await readResult<Paginated<Booking>>(
            await request(
              'GET',
              `/bookings?${query.replace('from=2026-10-20&to=2026-10-20', 'from=2026-10-21&to=2026-10-22')}`,
              staff,
            ),
          )
        ).total,
      ).toBe(0);
    }
    for (const query of [
      'page=0',
      'limit=101',
      'from=2026-02-30',
      'to=2026-10-01&from=2026-10-20',
      'facilityId=bad',
      'accountId=bad',
      'guestPhone=bad',
      'status=UNKNOWN',
      'date=2026-02-30',
    ]) {
      expect((await request('GET', `/bookings?${query}`, manager)).status).toBe(422);
    }
    expect((await request('GET', '/bookings/not-a-uuid', manager)).status).toBe(422);
    expect((await request('GET', '/bookings', coach)).status).toBe(403);
    expect((await request('GET', `/bookings/${guest.id}`, coach)).status).toBe(403);
    for (const staff of [manager, receptionist, coach])
      expect((await request('GET', '/me/bookings', staff)).status).toBe(403);
    const port = (server.address() as { port: number }).port;
    expect((await fetch(`http://localhost:${port}/api/v1/me/bookings`)).status).toBe(401);
  });

  test('purchased packages return ordered bookings with null paidAmount and only the owner sees them', async () => {
    await prisma.systemSetting.create({ data: {} });
    const member = await createAccount('MEMBER', 'member@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const court = await seedFacility(1);
    await seedBalance(member.id, 500000);
    const startDate = addDays(todayInCenter(), 1);
    const response = await request('POST', '/checkout', member, {
      items: [
        {
          type: 'FACILITY_PACKAGE',
          facilityId: court.id,
          startDate,
          daysOfWeek: [new Date(startDate).getUTCDay()],
          startTime: '08:00',
          endTime: '09:00',
          weeks: 2,
        },
      ],
      expectedTotal: 200000,
      paymentMethod: 'WALLET',
      idempotencyKey: 'package-view',
    });
    expect(response.status).toBe(201);
    const packages = await readResult<FacilityPackage[]>(await request('GET', '/me/facility-packages', member));
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      status: 'ACTIVE',
      startDate,
      endDate: addDays(startDate, 7),
      unitPrice: 100000,
    });
    expect(packages[0]?.bookings.map((b) => b.date)).toEqual([startDate, addDays(startDate, 7)]);
    for (const b of packages[0]!.bookings) {
      expect(b).toMatchObject({ packageId: packages[0]!.id, paidAmount: null, account: { id: member.id } });
      expect(await readResult<Booking>(await request('GET', `/bookings/${b.id}`, member))).toEqual(b);
    }
    expect(await readResult<unknown[]>(await request('GET', '/me/facility-packages', other))).toEqual([]);
    const manager = await createAccount('MANAGER', 'manager@example.com');
    expect((await request('GET', '/me/facility-packages', manager)).status).toBe(403);
  });
});
