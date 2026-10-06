import type { Order, Quote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { expectOrderConsistent } from './helpers/order';
import { seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

const today = todayInCenter();
const firstDay = addDays(today, 3);
const secondDay = addDays(today, 10);
const enrollment = (classId: string) => ({ type: 'COURSE_ENROLLMENT', classId });

const pay = (items: unknown[], expectedTotal: number, idempotencyKey: string) => ({
  items,
  paymentMethod: 'WALLET',
  expectedTotal,
  idempotencyKey,
});

beforeAll(async () => {
  ({ server, request } = await startServer('/checkout'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('course enrollment line', () => {
  test('two members racing for the last seat: only one is enrolled', async () => {
    const cls = await seedOpenClass({ maxStudents: 1 });
    const members = await Promise.all(
      ['a@example.com', 'b@example.com'].map((email) => createAccount('MEMBER', email)),
    );
    await Promise.all(members.map(({ id }) => seedBalance(id, 300_000)));

    const responses = await Promise.all(
      members.map((member, index) =>
        request('POST', '/', member, pay([enrollment(cls.id)], 300_000, `seat-race-${index}`)),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(await readCode(responses.find(({ status }) => status === 409)!)).toBe('CART_ITEM_INVALID');
    expect(await prisma.classEnrollment.count()).toBe(1);
    const balances = await Promise.all(members.map(({ id }) => expectWalletConsistent(id)));
    expect(balances.sort()).toEqual([0, 300_000]);
  });

  test('a member enrolls once at the class discount, and again only after cancelling', async () => {
    const cls = await seedOpenClass();
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 600_000);
    await giveActiveMembership(member.id, { classDiscountPct: 10 });

    const twice = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [enrollment(cls.id), enrollment(cls.id)] }),
    );
    expect(twice.items.map(({ valid, total, error }) => ({ valid, total, code: error?.code }))).toEqual([
      { valid: true, total: 270_000, code: undefined },
      { valid: false, total: 0, code: 'CONFLICT' },
    ]);
    expect(twice.items[0]!.snapshot).toMatchObject({ sessions: 2, startDate: firstDay, endDate: secondDay });

    const first = await readResult<Order>(
      await request('POST', '/', member, pay([enrollment(cls.id)], 270_000, 'enroll-key-1')),
    );
    await expectOrderConsistent(first.id);
    expect(await readCode(await request('POST', '/', member, pay([enrollment(cls.id)], 270_000, 'enroll-key-2')))).toBe(
      'CART_ITEM_INVALID',
    );

    await prisma.classEnrollment.updateMany({ data: { status: 'CANCELLED', cancelledAt: new Date() } });
    const second = await readResult<Order>(
      await request('POST', '/', member, pay([enrollment(cls.id)], 270_000, 'enroll-key-3')),
    );

    const enrollments = await prisma.classEnrollment.findMany({ orderBy: { enrolledAt: 'asc' } });
    expect(enrollments.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: first.items[0]!.refId!, status: 'CANCELLED' },
      { id: second.items[0]!.refId!, status: 'ENROLLED' },
    ]);
  });

  test('started classes, guests and clashes with other lines of the order are rejected', async () => {
    const cls = await seedOpenClass();
    const started = await seedOpenClass({ startDate: today });
    const court = await seedFacility(1);
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const booking = {
      type: 'FACILITY_BOOKING',
      facilityId: court.id,
      date: firstDay,
      startTime: '19:00',
      endTime: '20:00',
    };

    const quote = await readResult<Quote>(
      await request('POST', '/quote', member, { items: [enrollment(cls.id), booking, enrollment(started.id)] }),
    );
    expect(quote.items.map(({ valid, error }) => (valid ? null : error?.code))).toEqual([
      null,
      'SCHEDULE_CONFLICT',
      'INVALID_STATE',
    ]);

    const guest = await readResult<Quote>(
      await request('POST', '/quote', receptionist, {
        buyer: { guest: { name: 'Khách A', phone: '0901234567' } },
        items: [enrollment(cls.id)],
      }),
    );
    expect(guest.items[0]!.error?.code).toBe('GUEST_NOT_ALLOWED');
  });
});
