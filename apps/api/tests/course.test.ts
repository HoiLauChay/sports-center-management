import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { MAX_MONEY, type Course } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import sportRepository from '~/repositories/sport.repository';
import auditService from '~/services/audit.service';
import { resetDatabase } from './helpers/db';
import type { buildFetcher } from './helpers/http';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let req: ReturnType<typeof buildFetcher>;
let serverPort: number;

beforeAll(async () => {
  ({ server, request: req } = await startServer('/courses'));
  serverPort = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());
beforeEach(resetDatabase);
afterEach(() => mock.restore());

type CourseResult = Course;

interface ErrorResponse {
  status: false;
  code: string;
  message: string;
  errors?: { path: string; message: string }[];
}

const readError = async (response: Response): Promise<ErrorResponse> => (await response.json()) as ErrorResponse;

describe('course crud and business rules', () => {
  test('manager creates, updates, lists and deletes course; member can list active courses', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');

    const sport = await prisma.sport.create({
      data: { name: 'Boxing', description: 'Môn Boxing', isActive: true },
    });

    // 1. Create course
    const createRes = await req('POST', '/', manager, {
      name: 'Boxing cơ bản',
      description: 'Khóa học boxing 12 buổi cho người mới',
      sportId: sport.id,
      totalSessions: 12,
      price: 1200000,
    });
    expect(createRes.status).toBe(201);
    const created = await readResult<CourseResult>(createRes);
    expect(created).toMatchObject({
      name: 'Boxing cơ bản',
      description: 'Khóa học boxing 12 buổi cho người mới',
      sport: { id: sport.id, name: 'Boxing' },
      totalSessions: 12,
      price: 1200000,
      thumbnailUrl: null,
    });

    // 2. Update course
    const updateRes = await req('PATCH', `/${created.id}`, manager, {
      name: 'Boxing nâng cao',
      price: 1500000,
      totalSessions: 15,
    });
    expect(updateRes.status).toBe(200);
    const updated = await readResult<CourseResult>(updateRes);
    expect(updated).toMatchObject({
      id: created.id,
      name: 'Boxing nâng cao',
      totalSessions: 15,
      price: 1500000,
      sport: { id: sport.id, name: 'Boxing' },
    });

    // 3. List courses as manager
    const managerListRes = await req('GET', '/', manager);
    expect(managerListRes.status).toBe(200);
    const managerList = await readResult<CourseResult[]>(managerListRes);
    expect(managerList).toHaveLength(1);
    expect(managerList[0]?.id).toBe(created.id);
    expect(managerList[0]?.name).toBe('Boxing nâng cao');

    // 4. List courses as member
    const memberListRes = await req('GET', '/', member);
    expect(memberListRes.status).toBe(200);
    const memberList = await readResult<CourseResult[]>(memberListRes);
    expect(memberList).toHaveLength(1);
    expect(memberList[0]?.id).toBe(created.id);

    // 5. Delete course (soft delete)
    const deleteRes = await req('DELETE', `/${created.id}`, manager);
    expect(deleteRes.status).toBe(200);
    expect(await readResult<Course>(deleteRes)).toEqual(updated);

    // Verify course is excluded from GET
    const afterDeleteList = await readResult<CourseResult[]>(await req('GET', '/', manager));
    expect(afterDeleteList).toHaveLength(0);

    // Verify database record still exists with deletedAt set
    const dbRecord = await prisma.course.findUnique({ where: { id: created.id } });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.deletedAt).not.toBeNull();

    // Verify audit logs for CREATE, UPDATE, DELETE with entityType COURSE
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityType: 'COURSE', entityId: created.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(auditLogs).toHaveLength(3);
    expect(auditLogs.map((l) => l.action)).toEqual(['CREATE', 'UPDATE', 'DELETE']);
  });

  test('authentication and authorization: 401 for unauthenticated, 403 for non-manager', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const coach = await createAccount('COACH', 'coach@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const manager = await createAccount('MANAGER', 'manager@example.com');

    const sport = await prisma.sport.create({ data: { name: 'Tennis', isActive: true } });
    const course = await prisma.course.create({
      data: {
        name: 'Tennis 101',
        sportId: sport.id,
        totalSessions: 10,
        price: 1000000,
      },
    });

    const unauthUrl = `http://localhost:${serverPort}/api/v1/courses`;
    const jsonHeaders = { 'Content-Type': 'application/json' };

    // 401 for unauthenticated
    expect((await fetch(unauthUrl)).status).toBe(401);
    expect((await fetch(unauthUrl, { method: 'POST', headers: jsonHeaders, body: '{}' })).status).toBe(401);
    expect(
      (await fetch(`${unauthUrl}/${course.id}`, { method: 'PATCH', headers: jsonHeaders, body: '{}' })).status,
    ).toBe(401);
    expect((await fetch(`${unauthUrl}/${course.id}`, { method: 'DELETE' })).status).toBe(401);

    // 403 for non-manager on mutations
    const payload = { name: 'Tennis 102', sportId: sport.id, totalSessions: 10, price: 1000000 };
    for (const nonManager of [member, coach, receptionist]) {
      expect((await req('POST', '/', nonManager, payload)).status).toBe(403);
      expect((await req('PATCH', `/${course.id}`, nonManager, { name: 'New name' })).status).toBe(403);
      expect((await req('DELETE', `/${course.id}`, nonManager)).status).toBe(403);
    }

    // Authenticated non-managers CAN list courses
    expect((await req('GET', '/', coach)).status).toBe(200);
    expect((await req('GET', '/', receptionist)).status).toBe(200);
    expect((await req('GET', '/', manager)).status).toBe(200);
  });

  test('invalid totalSessions or price returns 422', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Bơi lội', isActive: true } });

    const basePayload = {
      name: 'Bơi lội căn bản',
      sportId: sport.id,
      totalSessions: 10,
      price: 800000,
    };

    // totalSessions < 1
    const zeroSessions = await req('POST', '/', manager, { ...basePayload, totalSessions: 0 });
    expect(zeroSessions.status).toBe(422);
    expect(await readCode(zeroSessions)).toBe('VALIDATION_ERROR');

    const negativeSessions = await req('POST', '/', manager, { ...basePayload, totalSessions: -5 });
    expect(negativeSessions.status).toBe(422);

    const floatSessions = await req('POST', '/', manager, { ...basePayload, totalSessions: 2.5 });
    expect(floatSessions.status).toBe(422);

    // negative price
    const negativePrice = await req('POST', '/', manager, { ...basePayload, price: -1000 });
    expect(negativePrice.status).toBe(422);
    expect(await readCode(negativePrice)).toBe('VALIDATION_ERROR');

    const floatPrice = await req('POST', '/', manager, { ...basePayload, price: 500.5 });
    expect(floatPrice.status).toBe(422);

    // Invalid values on PATCH
    const course = await prisma.course.create({ data: basePayload });
    expect((await req('PATCH', `/${course.id}`, manager, { totalSessions: 0 })).status).toBe(422);
    expect((await req('PATCH', `/${course.id}`, manager, { price: -500 })).status).toBe(422);
  });

  test('create or update with deactivated or deleted sport returns 422 at body.sportId', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');

    // 1. Non-existent sport
    const nonExistentId = '00000000-0000-0000-0000-000000000099';
    const nonExistentRes = await req('POST', '/', manager, {
      name: 'Khóa học lạ',
      sportId: nonExistentId,
      totalSessions: 8,
      price: 500000,
    });
    expect(nonExistentRes.status).toBe(422);
    const nonExistentErr = await readError(nonExistentRes);
    expect(nonExistentErr.errors?.[0]?.path).toBe('body.sportId');

    // 2. Inactive sport (isActive = false)
    const inactiveSport = await prisma.sport.create({
      data: { name: 'Bóng rổ cũ', isActive: false },
    });
    const inactiveRes = await req('POST', '/', manager, {
      name: 'Bóng rổ cơ bản',
      sportId: inactiveSport.id,
      totalSessions: 8,
      price: 500000,
    });
    expect(inactiveRes.status).toBe(422);
    const inactiveErr = await readError(inactiveRes);
    expect(inactiveErr.errors?.[0]?.path).toBe('body.sportId');

    // 3. Soft-deleted sport (deletedAt != null)
    const deletedSport = await prisma.sport.create({
      data: { name: 'Bóng chuyền', isActive: true, deletedAt: new Date() },
    });
    const deletedRes = await req('POST', '/', manager, {
      name: 'Bóng chuyền cơ bản',
      sportId: deletedSport.id,
      totalSessions: 8,
      price: 500000,
    });
    expect(deletedRes.status).toBe(422);
    const deletedErr = await readError(deletedRes);
    expect(deletedErr.errors?.[0]?.path).toBe('body.sportId');

    // 4. Update with inactive or deleted sport
    const activeSport = await prisma.sport.create({ data: { name: 'Bóng đá', isActive: true } });
    const course = await prisma.course.create({
      data: { name: 'Bóng đá thiếu nhi', sportId: activeSport.id, totalSessions: 10, price: 600000 },
    });

    const updateInactive = await req('PATCH', `/${course.id}`, manager, { sportId: inactiveSport.id });
    expect(updateInactive.status).toBe(422);
    expect((await readError(updateInactive)).errors?.[0]?.path).toBe('body.sportId');

    const updateDeleted = await req('PATCH', `/${course.id}`, manager, { sportId: deletedSport.id });
    expect(updateDeleted.status).toBe(422);
    expect((await readError(updateDeleted)).errors?.[0]?.path).toBe('body.sportId');
  });

  test('PATCH without sportId verifies that current sport is still active and not deleted', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Cầu lông', isActive: true } });

    const course = await prisma.course.create({
      data: {
        name: 'Cầu lông nâng cao',
        sportId: sport.id,
        totalSessions: 12,
        price: 1000000,
      },
    });

    // When sport is deactivated
    await prisma.sport.update({ where: { id: sport.id }, data: { isActive: false } });

    const patchWhenDeactivated = await req('PATCH', `/${course.id}`, manager, {
      name: 'Cầu lông đỉnh cao',
    });
    expect(patchWhenDeactivated.status).toBe(422);
    const deactivatedErr = await readError(patchWhenDeactivated);
    expect(deactivatedErr.errors?.[0]?.path).toBe('body.sportId');

    // Re-activate sport then delete it
    await prisma.sport.update({ where: { id: sport.id }, data: { isActive: true, deletedAt: new Date() } });

    const patchWhenDeleted = await req('PATCH', `/${course.id}`, manager, {
      name: 'Cầu lông đỉnh cao 2',
    });
    expect(patchWhenDeleted.status).toBe(422);
    const deletedErr = await readError(patchWhenDeleted);
    expect(deletedErr.errors?.[0]?.path).toBe('body.sportId');
  });

  test('thumbnailUrl validation: external unuploaded image returns 422', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Yoga', isActive: true } });

    // Invalid external image on POST
    const res = await req('POST', '/', manager, {
      name: 'Yoga cơ bản',
      sportId: sport.id,
      totalSessions: 10,
      price: 800000,
      thumbnailUrl: 'https://external-site.com/fake-thumb.png',
    });
    expect(res.status).toBe(422);
    const err = await readError(res);
    expect(err.errors?.[0]?.path).toBe('body.thumbnailUrl');
    expect(await prisma.course.count()).toBe(0);

    // Invalid scheme
    const invalidScheme = await req('POST', '/', manager, {
      name: 'Yoga cơ bản',
      sportId: sport.id,
      totalSessions: 10,
      price: 800000,
      thumbnailUrl: 'http://not-https.com/image.png',
    });
    expect(invalidScheme.status).toBe(422);

    // Valid course created without thumbnail
    const course = await prisma.course.create({
      data: { name: 'Yoga nâng cao', sportId: sport.id, totalSessions: 10, price: 900000 },
    });

    // Invalid external image on PATCH
    const patchRes = await req('PATCH', `/${course.id}`, manager, {
      thumbnailUrl: 'https://external-site.com/hacked.png',
    });
    expect(patchRes.status).toBe(422);
    const patchErr = await readError(patchRes);
    expect(patchErr.errors?.[0]?.path).toBe('body.thumbnailUrl');
  });

  test('soft delete behavior: cannot update or delete an already deleted course', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Gym', isActive: true } });

    const course = await prisma.course.create({
      data: {
        name: 'Gym PT 1-1',
        sportId: sport.id,
        totalSessions: 10,
        price: 2000000,
        deletedAt: new Date(),
      },
    });

    // Trying to delete already deleted course -> 404
    const delRes = await req('DELETE', `/${course.id}`, manager);
    expect(delRes.status).toBe(404);
    expect(await readCode(delRes)).toBe('NOT_FOUND');

    // Trying to patch already deleted course -> 404
    const patchRes = await req('PATCH', `/${course.id}`, manager, { name: 'New Gym' });
    expect(patchRes.status).toBe(404);
    expect(await readCode(patchRes)).toBe('NOT_FOUND');
  });

  test('audit failure rolls back transaction during course creation', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Karate', isActive: true } });

    // Mock auditService.record to reject
    const originalRecord = auditService.record;
    auditService.record = async () => {
      throw new Error('Simulated audit logging failure');
    };
    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const res = await req('POST', '/', manager, {
        name: 'Karate đai đen',
        sportId: sport.id,
        totalSessions: 20,
        price: 2500000,
      });

      // Internal server error or failure due to audit
      expect(res.status).toBe(500);

      // Verify transaction rollback: no course created
      const count = await prisma.course.count({ where: { name: 'Karate đai đen' } });
      expect(count).toBe(0);
    } finally {
      console.error = originalConsoleError;
      auditService.record = originalRecord;
    }
  });

  test('sport validation uses the transaction holding the schedule lock on create and both PATCH variants', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
    const original = sportRepository.findActiveIds;
    const check = spyOn(sportRepository, 'findActiveIds').mockImplementation(async (ids, tx) => {
      expect(tx).toBeDefined();
      expect(tx).not.toBe(prisma);
      const locks = await tx!.$queryRaw<{ held: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM pg_locks WHERE pid = pg_backend_pid()
          AND locktype = 'advisory' AND classid = 74001 AND objid = 1 AND granted
        ) AS held
      `;
      expect(locks[0]?.held).toBe(true);
      return original(ids, tx);
    });
    const response = await req('POST', '/', manager, {
      name: 'Boxing',
      sportId: sport.id,
      totalSessions: 1,
      price: 0,
    });
    expect(response.status).toBe(201);
    const course = await readResult<Course>(response);
    expect((await req('PATCH', `/${course.id}`, manager, { name: 'New name' })).status).toBe(200);
    expect((await req('PATCH', `/${course.id}`, manager, { sportId: sport.id })).status).toBe(200);
    expect(check).toHaveBeenCalledTimes(3);
  });

  test('audit failure rolls back updates and soft deletes', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
    const course = await prisma.course.create({
      data: { name: 'Original', sportId: sport.id, totalSessions: 12, price: 1200000 },
    });
    spyOn(auditService, 'record').mockRejectedValue(new Error('Audit unavailable'));
    spyOn(console, 'error').mockImplementation(() => {});
    for (const method of ['PATCH', 'DELETE']) {
      expect((await req(method, `/${course.id}`, manager, method === 'PATCH' ? { price: 0 } : undefined)).status).toBe(
        500,
      );
      expect(await prisma.course.findUnique({ where: { id: course.id } })).toEqual(course);
      expect(await prisma.auditLog.count({ where: { entityType: 'COURSE' } })).toBe(0);
    }
  });

  test('concurrent deletes succeed once and write one audit entry', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
    const course = await prisma.course.create({
      data: { name: 'Boxing', sportId: sport.id, totalSessions: 1, price: 0 },
    });
    const responses = await Promise.all([
      req('DELETE', `/${course.id}`, manager),
      req('DELETE', `/${course.id}`, manager),
    ]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 404]);
    expect(await prisma.auditLog.count({ where: { entityType: 'COURSE', action: 'DELETE' } })).toBe(1);
  });

  test('thumbnail accepts the correct purpose and owner, can be retained by another manager or cleared', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const other = await createAccount('MANAGER', 'other@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
    const previousStore = env.BLOB_STORE_ID;
    env.BLOB_STORE_ID = 'course-test';
    const base = 'https://course-test.public.blob.vercel-storage.com';
    const filename = '00000000-0000-4000-8000-000000000001.png';
    const thumbnailUrl = `${base}/course-thumbnails/${manager.id}/${filename}`;
    const payload = { name: 'Boxing', sportId: sport.id, totalSessions: 1, price: 0 };
    try {
      for (const invalid of [
        `${base}/sport-icons/${manager.id}/${filename}`,
        `${base}/course-thumbnails/${other.id}/${filename}`,
      ]) {
        const rejected = await req('POST', '/', manager, { ...payload, thumbnailUrl: invalid });
        expect(rejected.status).toBe(422);
        expect((await readError(rejected)).errors?.[0]?.path).toBe('body.thumbnailUrl');
      }
      const response = await req('POST', '/', manager, { ...payload, thumbnailUrl });
      expect(response.status).toBe(201);
      const course = await readResult<Course>(response);
      expect(course.thumbnailUrl).toBe(thumbnailUrl);
      const retained = await req('PATCH', `/${course.id}`, other, { thumbnailUrl, name: 'Updated' });
      expect(retained.status).toBe(200);
      expect((await readResult<Course>(retained)).thumbnailUrl).toBe(thumbnailUrl);
      const cleared = await req('PATCH', `/${course.id}`, other, { thumbnailUrl: null, description: null });
      expect(cleared.status).toBe(200);
      expect(await readResult<Course>(cleared)).toMatchObject({ thumbnailUrl: null, description: null });
    } finally {
      env.BLOB_STORE_ID = previousStore;
    }
  });

  test('invalid IDs, names and numeric boundaries return validation errors without writes', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
    const payload = { name: 'Boxing', sportId: sport.id, totalSessions: 1, price: 0 };
    const created = await req('POST', '/', manager, payload);
    const course = await readResult<Course>(created);
    for (const invalid of [
      { name: '  ' },
      { name: 'x'.repeat(256) },
      { sportId: 'invalid' },
      { totalSessions: 2147483648 },
      { totalSessions: null },
      { price: MAX_MONEY + 1 },
      { price: 0.5 },
      { price: '100' },
    ]) {
      expect((await req('POST', '/', manager, { ...payload, ...invalid })).status).toBe(422);
      expect((await req('PATCH', `/${course.id}`, manager, invalid)).status).toBe(422);
    }
    for (const method of ['PATCH', 'DELETE']) {
      expect((await req(method, '/invalid', manager, method === 'PATCH' ? {} : undefined)).status).toBe(422);
      expect(
        (await req(method, '/00000000-0000-4000-8000-000000000099', manager, method === 'PATCH' ? {} : undefined))
          .status,
      ).toBe(404);
    }
    expect(await prisma.course.count()).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: 'COURSE' } })).toBe(1);
  });

  test('editing and deleting a template preserves existing classes and sessions', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
    const course = await prisma.course.create({
      data: { name: 'Boxing', sportId: sport.id, totalSessions: 1, price: 100000 },
    });
    const facility = await prisma.facility.create({
      data: { name: 'Room', type: 'COURT', capacityPerSlot: 10, pricePerSlot: 100000 },
    });
    const cls = await prisma.class.create({
      data: { name: 'Morning', courseId: course.id, facilityId: facility.id, maxStudents: 10, weeklySchedule: [] },
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
    expect((await req('PATCH', `/${course.id}`, manager, { totalSessions: 12, price: 1200000 })).status).toBe(200);
    expect(await prisma.class.findMany()).toEqual([cls]);
    expect(await prisma.classSession.findMany()).toEqual([session]);
    expect((await req('DELETE', `/${course.id}`, manager)).status).toBe(200);
    expect(await prisma.class.findMany()).toEqual([cls]);
    expect(await prisma.classSession.findMany()).toEqual([session]);
  });
});
