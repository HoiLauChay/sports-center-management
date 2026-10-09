import type { ClassSummary } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { addDays, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let baseUrl: string;

beforeAll(async () => {
  ({ server, request } = await startServer('/coach/classes'));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  baseUrl = `http://localhost:${address.port}/api/v1/coach/classes`;
});
afterAll(() => server.close());
beforeEach(resetDatabase);

let seq = 0;
const day = (offset: number) => new Date(addDays(todayInCenter(), offset));

const setup = async () => {
  const coach = await createAccount('COACH', 'coach@example.com');
  const other = await createAccount('COACH', 'other-coach@example.com');
  const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
  const course = await prisma.course.create({
    data: { name: 'Boxing cơ bản', sportId: sport.id, price: 100_000, totalSessions: 1 },
  });
  const facility = await prisma.facility.create({
    data: { name: 'Phòng Boxing', type: 'ROOM', capacityPerSlot: 1, pricePerSlot: 0 },
  });
  const makeClass = (data: Partial<Prisma.ClassUncheckedCreateInput> = {}) =>
    prisma.class.create({
      data: {
        name: `Lớp ${++seq}`,
        courseId: course.id,
        facilityId: facility.id,
        coachId: coach.id,
        weeklySchedule: [{ dayOfWeek: 2, startTime: '18:00', endTime: '19:00' }],
        minStudents: 1,
        maxStudents: 10,
        startDate: day(2),
        endDate: day(5),
        status: 'OPEN',
        ...data,
      },
    });
  return { coach, other, sport, course, facility, makeClass };
};

const enroll = async (classId: string, status: 'ENROLLED' | 'CANCELLED') => {
  const member = await createAccount('MEMBER', `member-${++seq}@example.com`);
  const order = await prisma.order.create({
    data: {
      orderNumber: `COACH-CLASSES-${seq}`,
      idempotencyKey: `coach-classes-${seq}`,
      accountId: member.id,
      paymentMethod: 'WALLET',
      subtotal: 100_000,
      totalAmount: 100_000,
      receiptSnapshot: { schema_version: 1 },
      items: {
        create: {
          lineNumber: 1,
          type: 'COURSE_ENROLLMENT',
          subtotal: 100_000,
          totalAmount: 100_000,
          itemSnapshot: { schema_version: 1 },
        },
      },
    },
    include: { items: true },
  });
  return prisma.classEnrollment.create({
    data: { classId, accountId: member.id, orderItemId: order.items[0]!.id, status },
  });
};

describe('coach classes', () => {
  test('requires authentication', async () => {
    const response = await fetch(baseUrl);
    expect([response.status, await readCode(response)]).toEqual([401, 'UNAUTHORIZED']);
  });

  for (const role of ['MANAGER', 'RECEPTIONIST', 'MEMBER'] as const) {
    test(`rejects ${role}`, async () => {
      const account = await createAccount(role, `${role}@example.com`);
      const response = await request('GET', '', account);
      expect([response.status, await readCode(response)]).toEqual([403, 'FORBIDDEN']);
    });
  }

  test('returns only currently assigned classes in every non-cancelled state', async () => {
    const { coach, other, makeClass } = await setup();
    const draft = await makeClass({ status: 'DRAFT', startDate: day(1), endDate: day(1) });
    const pending = await makeClass({ status: 'PENDING_APPROVAL' });
    const open = await makeClass({ startDate: day(3) });
    await makeClass({ coachId: other.id });
    await makeClass({ coachId: null, status: 'PENDING_APPROVAL' });
    await makeClass({ status: 'CANCELLED', cancelReason: 'Hủy lớp' });
    await makeClass({ deletedAt: new Date() });
    const registrationOnly = await makeClass({ status: 'PENDING_APPROVAL', coachId: other.id });
    await prisma.classCoachRegistration.create({
      data: { classId: registrationOnly.id, coachId: coach.id, source: 'COACH_REGISTERED' },
    });

    const response = await request('GET', '', coach);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: boolean; result: ClassSummary[] };
    expect(body.status).toBe(true);
    expect(body.result.map(({ id }) => id)).toEqual([draft.id, pending.id, open.id]);
    expect(body.result.every((cls) => cls.coach?.id === coach.id)).toBe(true);
  });

  test('sorts by start date and id, includes ongoing and completed classes, and puts null dates last', async () => {
    const { coach, makeClass } = await setup();
    const upcoming = await makeClass();
    const ongoing = await makeClass({ startDate: day(0) });
    const completed = await makeClass({ startDate: day(-5), endDate: day(-1) });
    const sameDate = await makeClass();
    const undated = await makeClass({ status: 'DRAFT', startDate: null, endDate: null });

    const rows = await readResult<ClassSummary[]>(await request('GET', '', coach));
    expect(rows.map(({ id }) => id)).toEqual([
      completed.id,
      ongoing.id,
      ...[upcoming.id, sameDate.id].sort(),
      undated.id,
    ]);
    expect(rows.map(({ derivedStatus }) => derivedStatus)).toEqual([
      'COMPLETED',
      'ONGOING',
      'UPCOMING',
      'UPCOMING',
      null,
    ]);
  });

  test('returns the shared class shape and counts only enrolled students', async () => {
    const { coach, sport, course, facility, makeClass } = await setup();
    const cls = await makeClass();
    await enroll(cls.id, 'ENROLLED');
    const cancelled = await enroll(cls.id, 'ENROLLED');
    await prisma.classEnrollment.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    const rows = await readResult<ClassSummary[]>(await request('GET', '', coach));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: cls.id,
      startDate: addDays(todayInCenter(), 2),
      endDate: addDays(todayInCenter(), 5),
      course: { id: course.id, price: 100_000, sport: { id: sport.id } },
      facility: { id: facility.id, name: facility.name },
      coach: { id: coach.id, fullName: coach.fullName },
      minStudents: 1,
      maxStudents: 10,
      enrolledCount: 1,
      cancelReason: null,
      weeklySchedule: [{ dayOfWeek: 2, startTime: '18:00', endTime: '19:00' }],
    });
    expect(rows[0]).not.toHaveProperty('sessions');
  });

  test('query parameters cannot change the authenticated coach or paginate the result', async () => {
    const { coach, other, makeClass } = await setup();
    const own = await makeClass();
    const second = await makeClass({ startDate: day(3) });
    const cancelled = await makeClass({ status: 'CANCELLED' });
    await makeClass({ coachId: other.id });
    const rows = await readResult<ClassSummary[]>(
      await request('GET', `?coachId=${other.id}&status=CANCELLED&page=99&limit=1`, coach),
    );
    expect(rows.map(({ id }) => id)).toEqual([own.id, second.id]);
    expect(rows.map(({ id }) => id)).not.toContain(cancelled.id);
  });

  test('returns all assigned classes rather than the default catalog page of 20', async () => {
    const { coach, makeClass } = await setup();
    for (let index = 0; index < 21; index++) await makeClass();
    const rows = await readResult<ClassSummary[]>(await request('GET', '', coach));
    expect(rows).toHaveLength(21);
    expect(rows.every((cls) => cls.enrolledCount === 0)).toBe(true);
  });

  test('returns an empty array when unassigned and reflects reassignment immediately', async () => {
    const { coach, other, makeClass } = await setup();
    expect(await readResult<ClassSummary[]>(await request('GET', '', coach))).toEqual([]);
    const cls = await makeClass();
    await prisma.class.update({ where: { id: cls.id }, data: { coachId: other.id } });
    expect(await readResult<ClassSummary[]>(await request('GET', '', coach))).toEqual([]);
    expect((await readResult<ClassSummary[]>(await request('GET', '', other))).map(({ id }) => id)).toEqual([cls.id]);
  });
});
