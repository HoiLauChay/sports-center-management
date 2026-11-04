import type {
  BankTransaction,
  ClassDetail,
  ClassSummary,
  Coupon,
  Maintenance,
  Paginated,
  Specialization,
} from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { ClassStatus } from '~/generated/prisma/client';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer, type Viewer } from './helpers/http';
import { seedFacility } from './helpers/schedule';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const today = todayInCenter();
const day = (offset: number) => new Date(addDays(today, offset));
const hours = (offset: number) => new Date(Date.now() + offset * 60 * 60 * 1000);

const seedClasses = async (classes: { name: string; status: ClassStatus; start: number; end: number }[]) => {
  const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
  const course = await prisma.course.create({
    data: { name: 'Boxing cơ bản', sportId: sport.id, price: 300_000, totalSessions: 2 },
  });
  const room = await seedFacility(1, { type: 'ROOM' });
  const coach = await createAccount('COACH', 'class-coach@example.com');
  for (const { name, status, start, end } of classes) {
    await prisma.class.create({
      data: {
        courseId: course.id,
        facilityId: room.id,
        coachId: status === 'OPEN' ? coach.id : null,
        name,
        weeklySchedule: [],
        maxStudents: 10,
        startDate: day(start),
        endDate: day(end),
        status,
      },
    });
  }
  return { course, room };
};

const classes = [
  { name: 'cancelled-old', status: 'CANCELLED', start: -40, end: -10 },
  { name: 'ended-long-ago', status: 'OPEN', start: -60, end: -30 },
  { name: 'draft-later', status: 'DRAFT', start: 30, end: 60 },
  { name: 'pending-later', status: 'PENDING_APPROVAL', start: 20, end: 50 },
  { name: 'running', status: 'OPEN', start: -5, end: 20 },
  { name: 'ended-recently', status: 'OPEN', start: -30, end: -1 },
  { name: 'pending-soon', status: 'PENDING_APPROVAL', start: 3, end: 30 },
  { name: 'upcoming', status: 'OPEN', start: 7, end: 40 },
  { name: 'cancelled-new', status: 'CANCELLED', start: 10, end: 40 },
  { name: 'draft-soon', status: 'DRAFT', start: 5, end: 35 },
  { name: 'ends-today', status: 'OPEN', start: -20, end: 0 },
] as const;

const expectedOrder = [
  'pending-soon',
  'pending-later',
  'ends-today',
  'running',
  'upcoming',
  'draft-soon',
  'draft-later',
  'ended-recently',
  'ended-long-ago',
  'cancelled-new',
  'cancelled-old',
];

const listClasses = async (viewer: Viewer, query: string) =>
  readResult<Paginated<ClassSummary>>(await request('GET', `/classes?${query}`, viewer));

describe('manager class list', () => {
  test('puts classes waiting for approval first, then running and upcoming ones, finished and cancelled last', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await seedClasses([...classes]);

    const all = await listClasses(manager, 'page=1&limit=50');
    expect(all.total).toBe(classes.length);
    expect(all.items.map(({ name }) => name)).toEqual(expectedOrder);
  });

  test('pages through the order without repeating or skipping a class', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await seedClasses([...classes]);

    for (const limit of [1, 2, 3, 4, 5]) {
      const seen: string[] = [];
      for (let page = 1; page <= Math.ceil(classes.length / limit); page++) {
        const result = await listClasses(manager, `page=${page}&limit=${limit}`);
        expect(result.total).toBe(classes.length);
        expect(result.items.length).toBe(Math.min(limit, classes.length - (page - 1) * limit));
        seen.push(...result.items.map(({ name }) => name));
      }
      expect(seen).toEqual(expectedOrder);
    }
    const past = await listClasses(manager, `page=4&limit=4`);
    expect(past.items).toEqual([]);
    expect(past.total).toBe(classes.length);
  });

  test('keeps the group order and counts inside a status tab or a search', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await seedClasses([...classes]);

    const open = await listClasses(manager, 'status=OPEN&page=1&limit=2');
    expect(open.total).toBe(5);
    expect(open.items.map(({ name }) => name)).toEqual(['ends-today', 'running']);
    const openRest = await listClasses(manager, 'status=OPEN&page=2&limit=3');
    expect(openRest.items.map(({ name }) => name)).toEqual(['ended-recently', 'ended-long-ago']);

    const search = await listClasses(manager, 'q=draft&page=1&limit=10');
    expect(search.total).toBe(2);
    expect(search.items.map(({ name }) => name)).toEqual(['draft-soon', 'draft-later']);
  });

  test('other roles keep the start date order', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    await seedClasses([...classes]);

    const result = await listClasses(coach, 'page=1&limit=50');
    const starts = result.items.map(({ startDate }) => startDate!);
    expect(starts).toEqual([...starts].sort());
  });
});

describe('other manager lists', () => {
  test('specialization requests waiting longest come first, reviewed ones latest first', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    const sports = await Promise.all(
      ['A', 'B', 'C', 'D'].map((name) => prisma.sport.create({ data: { name: `Sport ${name}` } })),
    );
    const seed = (sport: number, status: 'PENDING' | 'APPROVED' | 'REJECTED', created: number, reviewed?: number) =>
      prisma.coachSpecialization.create({
        data: {
          coachId: coach.id,
          sportId: sports[sport]!.id,
          status,
          createdAt: hours(created),
          reviewedAt: reviewed === undefined ? null : hours(reviewed),
        },
      });
    const reviewedOld = await seed(0, 'APPROVED', -50, -40);
    const pendingNew = await seed(1, 'PENDING', -1);
    const reviewedNew = await seed(2, 'REJECTED', -30, -2);
    const pendingOld = await seed(3, 'PENDING', -20);

    const first = await readResult<Paginated<Specialization>>(
      await request('GET', '/specializations?page=1&limit=3', manager),
    );
    const second = await readResult<Paginated<Specialization>>(
      await request('GET', '/specializations?page=2&limit=3', manager),
    );
    expect(first.total).toBe(4);
    expect([...first.items, ...second.items].map(({ id }) => id)).toEqual([
      pendingOld.id,
      pendingNew.id,
      reviewedNew.id,
      reviewedOld.id,
    ]);
  });

  test('unmatched bank transactions come first, the oldest on top', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const seed = (status: 'MATCHED' | 'UNMATCHED' | 'IGNORED', offset: number) =>
      prisma.bankTransaction.create({
        data: {
          bankName: 'MB',
          accountNumber: '0123',
          amount: 100_000,
          content: `CK ${offset}`,
          transactionDate: hours(offset),
          status,
          rawPayload: {},
        },
      });
    const matchedOld = await seed('MATCHED', -48);
    const unmatchedNew = await seed('UNMATCHED', -1);
    const ignoredNew = await seed('IGNORED', -2);
    const unmatchedOld = await seed('UNMATCHED', -24);

    const pages = await Promise.all(
      [1, 2].map(async (page) =>
        readResult<Paginated<BankTransaction>>(
          await request('GET', `/bank-transactions?page=${page}&limit=2`, manager),
        ),
      ),
    );
    expect(pages[0]!.total).toBe(4);
    expect(pages.flatMap(({ items }) => items.map(({ id }) => id))).toEqual([
      unmatchedOld.id,
      unmatchedNew.id,
      ignoredNew.id,
      matchedOld.id,
    ]);
  });

  test('maintenances list the ongoing ones, then upcoming, then finished', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const court = await seedFacility(1);
    const seed = (start: number, end: number) =>
      prisma.facilityMaintenance.create({
        data: { facilityId: court.id, startAt: hours(start), endAt: hours(end), reason: 'x', createdById: manager.id },
      });
    const doneOld = await seed(-100, -90);
    const later = await seed(50, 60);
    const ongoing = await seed(-1, 5);
    const doneNew = await seed(-10, -5);
    const soon = await seed(10, 20);

    const listed = await readResult<Maintenance[]>(await request('GET', '/maintenances', manager));
    expect(listed.map(({ id }) => id)).toEqual([ongoing.id, soon.id, later.id, doneNew.id, doneOld.id]);
  });

  test('usable coupons come first, expiring soonest on top', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const seed = (code: string, from: number, to: number, data: { isActive?: boolean; maxUses?: number } = {}) =>
      prisma.coupon.create({
        data: {
          code,
          name: code,
          discountType: 'PERCENT',
          discountValue: 10,
          validFrom: hours(from),
          validTo: hours(to),
          ...data,
        },
      });
    await seed('EXPIRED', -100, -10);
    await seed('LATE', -10, 200);
    await seed('OFF', -10, 300, { isActive: false });
    await seed('FUTURE', 50, 300);
    await seed('SOON', -10, 20);
    await seed('USEDUP', -10, 100, { maxUses: 0 });

    const listed = await readResult<Coupon[]>(await request('GET', '/coupons', manager));
    expect(listed.map(({ code }) => code)).toEqual(['SOON', 'LATE', 'FUTURE', 'OFF', 'USEDUP', 'EXPIRED']);
  });

  test('class detail lists pending coach registrations first', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const coaches = await Promise.all([1, 2, 3, 4].map((n) => createAccount('COACH', `coach${n}@example.com`)));
    await seedClasses([{ name: 'needs-coach', status: 'PENDING_APPROVAL', start: 10, end: 40 }]);
    const cls = await prisma.class.findFirstOrThrow();
    const seed = (coach: number, status: 'PENDING' | 'APPROVED' | 'REJECTED', created: number) =>
      prisma.classCoachRegistration.create({
        data: {
          classId: cls.id,
          coachId: coaches[coach]!.id,
          source: 'COACH_REGISTERED',
          status,
          createdAt: hours(created),
        },
      });
    const rejectedOld = await seed(0, 'REJECTED', -50);
    const pendingNew = await seed(1, 'PENDING', -1);
    const rejectedNew = await seed(2, 'REJECTED', -5);
    const pendingOld = await seed(3, 'PENDING', -20);

    const detail = await readResult<ClassDetail>(await request('GET', `/classes/${cls.id}`, manager));
    expect(detail.coachRegistrations!.map(({ id }) => id)).toEqual([
      pendingOld.id,
      pendingNew.id,
      rejectedNew.id,
      rejectedOld.id,
    ]);
  });
});
