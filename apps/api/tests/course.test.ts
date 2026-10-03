import type { Course } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/courses'));
});

afterAll(() => server.close());
beforeEach(resetDatabase);

const errorPaths = async (response: Response) =>
  ((await response.json()) as { errors?: { path: string }[] }).errors?.map(({ path }) => path) ?? [];

const body = (sportId: string) => ({ name: 'Boxing cơ bản', sportId, totalSessions: 12, price: 1_200_000 });

const classOf = async (courseId: string) => {
  const facility = await prisma.facility.create({
    data: { name: 'Phòng Boxing 1', type: 'ROOM', capacityPerSlot: 10, pricePerSlot: 100_000 },
  });
  const cls = await prisma.class.create({
    data: { name: 'Lớp A', courseId, facilityId: facility.id, maxStudents: 10, weeklySchedule: [] },
  });
  const session = await prisma.classSession.create({
    data: {
      classId: cls.id,
      facilityId: facility.id,
      sessionNumber: 1,
      sessionDate: new Date('2026-10-20'),
      startTime: new Date('1970-01-01T07:00:00Z'),
      endTime: new Date('1970-01-01T08:00:00Z'),
    },
  });
  return { cls, session };
};

describe('courses', () => {
  test('manager manages courses with audit; others only read courses of active sports', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const boxing = await prisma.sport.create({ data: { name: 'Boxing' } });
    const yoga = await prisma.sport.create({ data: { name: 'Yoga' } });

    const created = await readResult<Course>(await request('POST', '/', manager, body(boxing.id)));
    expect(created).toMatchObject({ sport: { id: boxing.id, name: 'Boxing' }, totalSessions: 12, price: 1_200_000 });
    const updated = await readResult<Course>(
      await request('PATCH', `/${created.id}`, manager, { name: 'Boxing nâng cao', price: 1_500_000 }),
    );
    expect(updated).toMatchObject({ id: created.id, name: 'Boxing nâng cao', price: 1_500_000 });

    const yogaCourse = await readResult<Course>(await request('POST', '/', manager, body(yoga.id)));
    await prisma.sport.update({ where: { id: yoga.id }, data: { isActive: false } });
    const ids = async (viewer: typeof manager) =>
      (await readResult<Course[]>(await request('GET', '/', viewer))).map(({ id }) => id).sort();
    expect(await ids(manager)).toEqual([created.id, yogaCourse.id].sort());
    expect(await ids(member)).toEqual([created.id]);
    expect((await request('POST', '/', member, body(boxing.id))).status).toBe(403);

    expect((await request('DELETE', `/${created.id}`, manager)).status).toBe(200);
    expect(await ids(manager)).toEqual([yogaCourse.id]);
    expect((await request('PATCH', `/${created.id}`, manager, { price: 1 })).status).toBe(404);
    expect(
      (await prisma.auditLog.findMany({ where: { entityId: created.id }, orderBy: { createdAt: 'asc' } })).map(
        ({ action }) => action,
      ),
    ).toEqual(['CREATE', 'UPDATE', 'DELETE']);
  });

  test('invalid numbers and inactive or deleted sports are rejected with 422', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const boxing = await prisma.sport.create({ data: { name: 'Boxing' } });
    const stopped = await prisma.sport.create({ data: { name: 'Judo', isActive: false } });
    const removed = await prisma.sport.create({ data: { name: 'Karate', deletedAt: new Date() } });

    const invalid = await request('POST', '/', manager, { ...body(boxing.id), totalSessions: 0, price: -1 });
    expect(invalid.status).toBe(422);
    expect((await errorPaths(invalid)).sort()).toEqual(['body.price', 'body.totalSessions']);

    for (const sportId of [stopped.id, removed.id]) {
      const response = await request('POST', '/', manager, body(sportId));
      expect(response.status).toBe(422);
      expect(await errorPaths(response)).toEqual(['body.sportId']);
    }

    const course = await readResult<Course>(await request('POST', '/', manager, body(boxing.id)));
    expect(await errorPaths(await request('PATCH', `/${course.id}`, manager, { sportId: stopped.id }))).toEqual([
      'body.sportId',
    ]);
    await prisma.sport.update({ where: { id: boxing.id }, data: { isActive: false } });
    expect(await errorPaths(await request('PATCH', `/${course.id}`, manager, { name: 'Boxing 2' }))).toEqual([
      'body.sportId',
    ]);
    expect(await prisma.course.count()).toBe(1);
  });

  test('a course with classes keeps its sport; editing or deleting the template leaves classes untouched', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const boxing = await prisma.sport.create({ data: { name: 'Boxing' } });
    const yoga = await prisma.sport.create({ data: { name: 'Yoga' } });
    const course = await readResult<Course>(await request('POST', '/', manager, body(boxing.id)));
    const { cls, session } = await classOf(course.id);

    const moved = await request('PATCH', `/${course.id}`, manager, { sportId: yoga.id });
    expect(moved.status).toBe(409);
    expect(await readCode(moved)).toBe('HAS_DEPENDENCIES');

    expect((await request('PATCH', `/${course.id}`, manager, { totalSessions: 20, price: 1 })).status).toBe(200);
    expect((await request('DELETE', `/${course.id}`, manager)).status).toBe(200);
    expect(await prisma.class.findMany()).toEqual([cls]);
    expect(await prisma.classSession.findMany()).toEqual([session]);
  });
});
