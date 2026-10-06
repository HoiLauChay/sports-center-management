import type { ClassDetail, ClassSummary, Paginated } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { Prisma, Role } from '~/generated/prisma/client';
import classRepository from '~/repositories/class.repository';
import notificationService from '~/services/notification.service';
import { formatDate, toDbTime, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
const emails = spyOn(notificationService, 'sendEmailsAfterCommit').mockImplementation(() => {});

beforeAll(async () => ({ server, request } = await startServer('/classes')));
afterAll(() => {
  server.close();
  emails.mockRestore();
});
beforeEach(async () => {
  await resetDatabase();
  emails.mockClear();
});

const day = (offset: number) => new Date(Date.parse(todayInCenter()) + offset * 86_400_000);
let seq = 0;

const setup = async () => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const member = await createAccount('MEMBER', 'member@example.com');
  const other = await createAccount('MEMBER', 'other@example.com');
  const coach = await createAccount('COACH', 'coach@example.com');
  const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
  await prisma.coachSpecialization.create({ data: { coachId: coach.id, sportId: sport.id, status: 'APPROVED' } });
  const course = await prisma.course.create({
    data: { name: 'Boxing cơ bản', sportId: sport.id, price: 100_000, totalSessions: 1 },
  });
  const room = await prisma.facility.create({
    data: { name: 'Phòng', type: 'ROOM', capacityPerSlot: 1, pricePerSlot: 0 },
  });
  let sessionSlot = 0;
  const makeClass = (data: Partial<Prisma.ClassUncheckedCreateInput> = {}) =>
    prisma.class.create({
      data: {
        courseId: course.id,
        facilityId: room.id,
        coachId: coach.id,
        name: `Boxing ${++seq}`,
        weeklySchedule: [],
        minStudents: 2,
        maxStudents: 10,
        startDate: day(2),
        endDate: day(2),
        status: 'OPEN',
        sessions: {
          create: {
            facilityId: room.id,
            sessionNumber: 1,
            sessionDate: day(2),
            startTime: toDbTime(360 + sessionSlot++ * 60),
            endTime: toDbTime(360 + sessionSlot * 60),
          },
        },
        ...data,
      },
    });
  const enroll = async (classId: string, accountId = member.id, status: 'ENROLLED' | 'CANCELLED' = 'ENROLLED') => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `CLASS-TEST-${++seq}`,
        idempotencyKey: `class-test-${seq}`,
        accountId,
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
    return prisma.classEnrollment.create({ data: { classId, accountId, status, orderItemId: order.items[0]!.id } });
  };
  return { manager, member, other, coach, sport, course, room, makeClass, enroll };
};
const list = async (viewer: { id: string; role: Role }, query = '') =>
  readResult<Paginated<ClassSummary>>(await request('GET', `/${query}`, viewer));

describe('class viewing, editing and approval', () => {
  test('Member list and detail show catalog plus own purchased history, never another member’s private class', async () => {
    const { member, other, manager, makeClass, enroll } = await setup();
    const open = await makeClass();
    const draft = await makeClass({ status: 'DRAFT' });
    const purchased = await makeClass({ status: 'PENDING_APPROVAL', coachId: null });
    const cancelled = await makeClass({ status: 'CANCELLED' });
    const started = await makeClass({ startDate: day(0), endDate: day(1) });
    await enroll(purchased.id);
    await enroll(cancelled.id, member.id, 'CANCELLED');
    await enroll(draft.id, other.id);
    const page = await list(member);
    expect(page.items.map(({ id }) => id).sort()).toEqual([open.id, purchased.id, cancelled.id].sort());
    expect(page.total).toBe(3);
    expect((await list(manager)).total).toBe(5);
    for (const cls of [draft, started]) expect((await request('GET', `/${cls.id}`, member)).status).toBe(404);
    expect((await request('GET', `/${purchased.id}`, other)).status).toBe(404);
    const detail = await readResult<ClassDetail>(await request('GET', `/${purchased.id}`, member));
    expect(detail.sessions).toHaveLength(1);
    expect(detail.sessions[0]).toMatchObject({ sessionNumber: 1, startTime: '08:00', endTime: '09:00' });
    expect((await list(member, '?status=DRAFT')).total).toBe(0);
    expect((await list(member, '?q=Boxing')).total).toBe(3);
  });

  test('filters and pagination preserve accurate totals; derived statuses include both day boundaries', async () => {
    const { manager, sport, course, coach, room, makeClass } = await setup();
    const upcoming = await makeClass({ name: 'Morning BOXING' });
    const ongoing = await makeClass({ startDate: day(0), endDate: day(0) });
    const completed = await makeClass({ startDate: day(-2), endDate: day(-1) });
    await makeClass({ status: 'DRAFT' });
    const query = `?q=morning&sportId=${sport.id}&courseId=${course.id}&coachId=${coach.id}&facilityId=${room.id}&status=OPEN&derivedStatus=UPCOMING`;
    expect((await list(manager, query)).items.map(({ id }) => id)).toEqual([upcoming.id]);
    expect((await list(manager, '?derivedStatus=ONGOING')).items).toMatchObject([
      { id: ongoing.id, derivedStatus: 'ONGOING' },
    ]);
    expect((await list(manager, '?derivedStatus=COMPLETED')).items).toMatchObject([
      { id: completed.id, derivedStatus: 'COMPLETED' },
    ]);
    const first = await list(manager, '?limit=2');
    const second = await list(manager, '?limit=2&page=2');
    expect(first.total).toBe(4);
    expect(second.total).toBe(4);
    expect(new Set([...first.items, ...second.items].map(({ id }) => id)).size).toBe(4);
    expect(first.items.every((row) => !('sessions' in row))).toBe(true);
  });

  test('full, deleted, coachless and sessionless classes are hidden from the catalog', async () => {
    const { member, makeClass, enroll } = await setup();
    const full = await makeClass({ minStudents: 1, maxStudents: 1 });
    await enroll(full.id);
    await makeClass({ coachId: null, status: 'PENDING_APPROVAL' });
    await makeClass({ sessions: undefined });
    const deleted = await makeClass({ deletedAt: new Date() });
    expect((await list(member)).items.map(({ id }) => id)).toEqual([full.id]);
    expect((await request('GET', `/${deleted.id}`, member)).status).toBe(404);
  });

  test('inactive or unqualified coaches cannot appear in the catalog or be approved', async () => {
    const { manager, member, coach, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    await prisma.coachSpecialization.updateMany({ data: { status: 'REJECTED' } });
    expect((await request('POST', `/${cls.id}/approve`, manager)).status).toBe(409);
    await prisma.class.update({ where: { id: cls.id }, data: { status: 'OPEN' } });
    expect((await list(member)).total).toBe(0);
    await prisma.coachSpecialization.updateMany({ data: { status: 'APPROVED' } });
    await prisma.account.update({ where: { id: coach.id }, data: { status: 'INACTIVE' } });
    expect((await list(member)).total).toBe(0);
  });

  test('edit and override are audited, retain original minimum and do not regenerate sessions', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass();
    const sessions = await prisma.classSession.findMany({ where: { classId: cls.id } });
    const response = await request('PATCH', `/${cls.id}`, manager, {
      name: 'Tên mới',
      maxStudents: 15,
      minStudentsOverride: true,
    });
    expect(response.status).toBe(200);
    expect(await readResult<ClassDetail>(response)).toMatchObject({
      name: 'Tên mới',
      maxStudents: 15,
      minStudents: 2,
      minStudentsOverride: true,
    });
    expect(await prisma.classSession.findMany({ where: { classId: cls.id } })).toEqual(sessions);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entityId: cls.id } });
    expect(audit).toMatchObject({
      action: 'UPDATE',
      newValues: { name: 'Tên mới', maxStudents: 15, minStudentsOverride: true },
    });
    expect((await request('PATCH', `/${cls.id}`, manager, { maxStudents: 1 })).status).toBe(422);
    expect((await request('PATCH', `/${cls.id}`, manager, { minStudentsOverride: false })).status).toBe(200);
  });

  test('cannot edit on start date, after start, after cancellation, or reduce capacity below current enrollments', async () => {
    const { manager, makeClass, enroll, member, other } = await setup();
    for (const data of [{ startDate: day(0) }, { startDate: day(-1) }, { status: 'CANCELLED' as const }]) {
      const cls = await makeClass(data);
      expect((await request('PATCH', `/${cls.id}`, manager, { name: 'X', minStudentsOverride: true })).status).toBe(
        409,
      );
    }
    const cls = await makeClass({ minStudents: 1 });
    await enroll(cls.id, member.id);
    await enroll(cls.id, other.id);
    expect((await request('PATCH', `/${cls.id}`, manager, { maxStudents: 1 })).status).toBe(409);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  test('approval without a coach returns 409 and changes nothing', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL', coachId: null });
    const response = await request('POST', `/${cls.id}/approve`, manager);
    expect(response.status).toBe(409);
    expect(await readCode(response)).toBe('CONFLICT');
    expect((await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).status).toBe('PENDING_APPROVAL');
    expect(await prisma.auditLog.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(emails).not.toHaveBeenCalled();
  });

  test('approval saves approver, audit and Coach notification; repeat approval conflicts', async () => {
    const { manager, coach, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    expect((await request('POST', `/${cls.id}/approve`, manager)).status).toBe(200);
    expect(await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).toMatchObject({
      status: 'OPEN',
      approvedById: manager.id,
      approvedAt: expect.any(Date),
    });
    expect(await prisma.auditLog.findFirstOrThrow()).toMatchObject({
      action: 'APPROVE',
      entityType: 'CLASS',
      oldValues: { status: 'PENDING_APPROVAL' },
      newValues: { status: 'OPEN' },
    });
    expect(await prisma.notification.findFirstOrThrow()).toMatchObject({
      accountId: coach.id,
      referenceId: cls.id,
      referenceType: 'CLASS',
      type: 'CLASS',
      sendEmail: true,
    });
    expect(emails).toHaveBeenCalledTimes(1);
    expect((await request('POST', `/${cls.id}/approve`, manager)).status).toBe(409);
    expect(await prisma.notification.count()).toBe(1);
  });

  test('rejection returns to DRAFT, clears approval metadata, notifies Coach and retains sessions', async () => {
    const { manager, coach, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL', approvedById: manager.id, approvedAt: new Date() });
    expect((await request('POST', `/${cls.id}/reject`, manager)).status).toBe(200);
    expect(await prisma.class.findUniqueOrThrow({ where: { id: cls.id } })).toMatchObject({
      status: 'DRAFT',
      approvedById: null,
      approvedAt: null,
    });
    expect(await prisma.classSession.count({ where: { classId: cls.id } })).toBe(1);
    expect(await prisma.auditLog.findFirstOrThrow()).toMatchObject({ action: 'REJECT' });
    expect(await prisma.notification.findFirstOrThrow()).toMatchObject({
      accountId: coach.id,
      title: 'Lớp học bị từ chối',
    });
    expect((await request('POST', `/${cls.id}/reject`, manager)).status).toBe(409);
  });

  test('review requires pending state and approval requires future valid sessions and an active course/sport', async () => {
    const { manager, makeClass, sport } = await setup();
    for (const data of [
      { status: 'DRAFT' as const },
      { status: 'OPEN' as const },
      { status: 'CANCELLED' as const },
      { startDate: day(0) },
      { sessions: undefined },
    ]) {
      const cls = await makeClass({ status: 'PENDING_APPROVAL', ...data });
      expect((await request('POST', `/${cls.id}/approve`, manager)).status).toBe(409);
    }
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    await prisma.sport.update({ where: { id: sport.id }, data: { isActive: false } });
    expect((await request('POST', `/${cls.id}/approve`, manager)).status).toBe(409);
    expect(await prisma.auditLog.count()).toBe(0);
  });

  test('concurrent approve and reject allow exactly one transition, audit and notification', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    const responses = await Promise.all(
      ['approve', 'reject'].map((action) => request('POST', `/${cls.id}/${action}`, manager)),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(await prisma.auditLog.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(1);
  });

  test('notification failure rolls back class and audit; email is never scheduled before commit', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    const failure = spyOn(notificationService, 'create').mockRejectedValueOnce(new Error('notification failed'));
    try {
      expect((await request('POST', `/${cls.id}/approve`, manager)).status).toBe(500);
      expect((await classRepository.findDetail(cls.id))?.status).toBe('PENDING_APPROVAL');
      expect(await prisma.auditLog.count()).toBe(0);
      expect(emails).not.toHaveBeenCalled();
    } finally {
      failure.mockRestore();
    }
  });

  test('only Manager can mutate; schemas reject invalid IDs, filters, empty bodies and forbidden fields', async () => {
    const { manager, member, coach, makeClass } = await setup();
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    for (const viewer of [member, coach, receptionist]) {
      expect((await request('PATCH', `/${cls.id}`, viewer, { name: 'X' })).status).toBe(403);
      for (const action of ['approve', 'reject'])
        expect((await request('POST', `/${cls.id}/${action}`, viewer)).status).toBe(403);
    }
    expect((await request('GET', '/not-a-uuid', manager)).status).toBe(422);
    expect((await request('GET', '/?derivedStatus=OPEN', manager)).status).toBe(422);
    expect((await request('GET', '/?page=0', manager)).status).toBe(422);
    for (const body of [
      {},
      { status: 'OPEN' },
      { coachId: coach.id },
      { minStudents: 0 },
      { minStudentsOverride: 'true' },
    ])
      expect((await request('PATCH', `/${cls.id}`, manager, body)).status).toBe(422);
    expect((await request('GET', `/${crypto.randomUUID()}`, manager)).status).toBe(404);
    expect((await request('PATCH', `/${crypto.randomUUID()}`, manager, { name: 'X' })).status).toBe(404);
    expect((await request('POST', `/${crypto.randomUUID()}/approve`, manager)).status).toBe(404);
    expect(formatDate(cls.startDate!)).toBe(formatDate(day(2)));
  });
});
