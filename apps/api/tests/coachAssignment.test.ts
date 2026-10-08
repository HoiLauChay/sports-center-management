import type { ClassDetail, ClassSummary, CoachRegistration, Paginated } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import notificationService from '~/services/notification.service';
import { addDays, todayInCenter, toDbTime } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
const emails = spyOn(notificationService, 'sendEmailsAfterCommit').mockImplementation(() => {});
beforeAll(async () => ({ server, request } = await startServer('')));
afterAll(() => {
  server.close();
  emails.mockRestore();
});
beforeEach(async () => {
  await resetDatabase();
  emails.mockClear();
});
let sequence = 0;
const day = (n: number) => new Date(addDays(todayInCenter(), n));

const setup = async () => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const coach = await createAccount('COACH', 'coach@example.com');
  const other = await createAccount('COACH', 'other@example.com');
  const unqualified = await createAccount('COACH', 'unqualified@example.com');
  const member = await createAccount('MEMBER', 'member@example.com');
  const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
  const sport = await prisma.sport.create({ data: { name: 'Boxing' } });
  await prisma.coachSpecialization.createMany({
    data: [coach, other].map(({ id }) => ({ coachId: id, sportId: sport.id, status: 'APPROVED' })),
  });
  const course = await prisma.course.create({
    data: { name: 'Boxing', sportId: sport.id, price: 100000, totalSessions: 2 },
  });
  const makeClass = async (data: Partial<Prisma.ClassUncheckedCreateInput> = {}, offset = 3, start = 600) => {
    const room = await prisma.facility.create({
      data: { name: `Room ${++sequence}`, type: 'ROOM', capacityPerSlot: 1, pricePerSlot: 0 },
    });
    return prisma.class.create({
      data: {
        name: `Class ${++sequence}`,
        maxStudents: 10,
        courseId: course.id,
        facilityId: room.id,
        weeklySchedule: [],
        startDate: day(offset),
        endDate: day(offset + 3),
        sessions: {
          create: [offset, offset + 3].map((n, i) => ({
            sessionNumber: i + 1,
            facilityId: room.id,
            sessionDate: day(n),
            startTime: toDbTime(start),
            endTime: toDbTime(start + 60),
          })),
        },
        ...data,
      },
    });
  };
  const register = async (id: string, who = coach) => request('POST', `/classes/${id}/coach-registrations`, who);
  const assign = (id: string, body: unknown) => request('POST', `/classes/${id}/assign-coach`, manager, body);
  return { manager, coach, other, unqualified, member, receptionist, sport, makeClass, register, assign };
};

describe('coach registration and assignment #171', () => {
  test('qualified coaches see draft candidates, register while awaiting assignment, and duplicate pending returns 409', async () => {
    const { coach, other, unqualified, makeClass, register } = await setup();
    const cls = await makeClass();
    const list = await readResult<Paginated<ClassSummary>>(await request('GET', '/classes?status=DRAFT', coach));
    expect(list.items.map(({ id }) => id)).toContain(cls.id);
    expect((await request('GET', `/classes/${cls.id}`, unqualified)).status).toBe(404);
    const first = await register(cls.id);
    expect(first.status).toBe(201);
    expect(await readResult<CoachRegistration>(first)).toMatchObject({
      classId: cls.id,
      source: 'COACH_REGISTERED',
      status: 'PENDING',
      coach: { id: coach.id },
    });
    expect(await prisma.class.findUnique({ where: { id: cls.id } })).toMatchObject({
      status: 'PENDING_APPROVAL',
      coachId: null,
    });
    expect((await register(cls.id, other)).status).toBe(201);
    expect((await register(cls.id)).status).toBe(409);
    expect(await prisma.classCoachRegistration.count()).toBe(2);
  });

  test('unapproved sport returns 403, wrong roles and invalid bodies are rejected', async () => {
    const { manager, coach, unqualified, member, receptionist, makeClass, register, assign } = await setup();
    const cls = await makeClass();
    const denied = await register(cls.id, unqualified);
    expect([denied.status, await readCode(denied)]).toEqual([403, 'FORBIDDEN']);
    for (const who of [manager, member, receptionist])
      expect((await request('POST', `/classes/${cls.id}/coach-registrations`, who)).status).toBe(403);
    for (const who of [coach, member, receptionist]) {
      expect((await request('POST', `/classes/${cls.id}/assign-coach`, who, { coachId: coach.id })).status).toBe(403);
      expect((await request('GET', `/classes/${cls.id}/coach-registrations`, who)).status).toBe(403);
    }
    for (const body of [
      {},
      { coachId: 'bad' },
      { coachId: coach.id, registrationId: crypto.randomUUID() },
      { coachId: coach.id, extra: true },
    ])
      expect((await assign(cls.id, body)).status).toBe(422);
    expect(await prisma.classCoachRegistration.count()).toBe(0);
  });

  test('manager selects one pending registration, rejects others, and approval remains a separate action', async () => {
    const { manager, coach, other, makeClass, register, assign } = await setup();
    const cls = await makeClass();
    const chosen = await readResult<CoachRegistration>(await register(cls.id));
    const rejected = await readResult<CoachRegistration>(await register(cls.id, other));
    const response = await assign(cls.id, { registrationId: chosen.id });
    expect(response.status).toBe(200);
    expect(await readResult<ClassDetail>(response)).toMatchObject({
      status: 'PENDING_APPROVAL',
      coach: { id: coach.id },
    });
    const registrations = await readResult<CoachRegistration[]>(
      await request('GET', `/classes/${cls.id}/coach-registrations`, manager),
    );
    expect(registrations.find(({ id }) => id === chosen.id)?.status).toBe('APPROVED');
    expect(
      (await readResult<ClassDetail>(await request('GET', `/classes/${cls.id}`, manager))).coachRegistrations,
    ).toHaveLength(2);
    expect(
      (await readResult<ClassDetail>(await request('GET', `/classes/${cls.id}`, coach))).coachRegistrations,
    ).toBeUndefined();
    expect(registrations.find(({ id }) => id === rejected.id)?.status).toBe('REJECTED');
    expect((await request('POST', `/classes/${cls.id}/approve`, manager, {})).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS_COACH_REGISTRATION', action: 'APPROVE' } })).toBe(
      1,
    );
    expect(await prisma.notification.count({ where: { referenceId: cls.id } })).toBe(3);
    expect((await assign(cls.id, { registrationId: rejected.id })).status).toBe(409);
  });

  test('direct assignment creates manager history and replacing an ongoing coach preserves approved decisions and OPEN', async () => {
    const { manager, coach, other, makeClass, assign } = await setup();
    const cls = await makeClass({ status: 'OPEN', coachId: coach.id }, -1);
    const old = await prisma.classCoachRegistration.create({
      data: {
        classId: cls.id,
        coachId: coach.id,
        source: 'COACH_REGISTERED',
        status: 'APPROVED',
        reviewedById: manager.id,
        reviewedAt: new Date(),
      },
    });
    const response = await assign(cls.id, { coachId: other.id });
    expect(response.status).toBe(200);
    expect(await readResult<ClassDetail>(response)).toMatchObject({ status: 'OPEN', coach: { id: other.id } });
    expect(await prisma.classCoachRegistration.findUnique({ where: { id: old.id } })).toMatchObject({
      status: 'APPROVED',
      reviewedAt: old.reviewedAt,
    });
    expect(await prisma.classCoachRegistration.findFirst({ where: { coachId: other.id } })).toMatchObject({
      source: 'MANAGER_ASSIGNED',
      status: 'APPROVED',
      reviewedById: manager.id,
    });
    expect((await assign(cls.id, { coachId: other.id })).status).toBe(409);
  });

  test('direct assignment rejects pending requests including that coach, without altering older approved history', async () => {
    const { coach, other, makeClass, register, assign } = await setup();
    const cls = await makeClass();
    await register(cls.id);
    await register(cls.id, other);
    expect((await assign(cls.id, { coachId: coach.id })).status).toBe(200);
    const rows = await prisma.classCoachRegistration.findMany({ where: { classId: cls.id } });
    expect(rows.filter(({ status }) => status === 'REJECTED')).toHaveLength(2);
    expect(rows.find(({ status }) => status === 'APPROVED')?.source).toBe('MANAGER_ASSIGNED');
  });

  test('conflicts rechecked on assignment; failure rolls back all decisions and notices', async () => {
    const { coach, makeClass, register, assign } = await setup();
    const target = await makeClass();
    const registration = await readResult<CoachRegistration>(await register(target.id));
    await makeClass({ status: 'OPEN', coachId: coach.id });
    const response = await assign(target.id, { registrationId: registration.id });
    expect([response.status, await readCode(response)]).toEqual([409, 'SCHEDULE_CONFLICT']);
    expect(await prisma.classCoachRegistration.findUnique({ where: { id: registration.id } })).toMatchObject({
      status: 'PENDING',
      reviewedAt: null,
    });
    expect(await prisma.class.findUnique({ where: { id: target.id } })).toMatchObject({ coachId: null });
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: 'APPROVE' } })).toBe(0);
    const newTarget = await makeClass();
    const failed = await register(newTarget.id);
    expect([failed.status, await readCode(failed)]).toEqual([409, 'SCHEDULE_CONFLICT']);
  });

  test('adjacent times are allowed and cancelled sessions do not conflict', async () => {
    const { coach, makeClass, register } = await setup();
    const occupied = await makeClass({ status: 'OPEN', coachId: coach.id });
    const adjacent = await makeClass({}, 3, 660);
    expect((await register(adjacent.id)).status).toBe(201);
    await prisma.classSession.updateMany({ where: { classId: occupied.id }, data: { status: 'CANCELLED' } });
    expect((await register((await makeClass()).id)).status).toBe(201);
  });

  test('wrong class registration, inactive coach, today, completed and cancelled classes are rejected', async () => {
    const { coach, makeClass, register, assign } = await setup();
    const cls = await makeClass();
    const registration = await readResult<CoachRegistration>(await register(cls.id));
    expect((await assign((await makeClass()).id, { registrationId: registration.id })).status).toBe(404);
    for (const data of [{ status: 'CANCELLED' as const }, { status: 'OPEN' as const, coachId: coach.id }])
      expect((await register((await makeClass(data)).id)).status).toBe(409);
    expect((await register((await makeClass({}, 0)).id)).status).toBe(409);
    expect(
      (await assign((await makeClass({ status: 'OPEN', coachId: coach.id }, -5)).id, { coachId: coach.id })).status,
    ).toBe(409);
    await prisma.account.update({ where: { id: coach.id }, data: { status: 'INACTIVE' } });
    expect((await assign(cls.id, { registrationId: registration.id })).status).toBe(403);
    expect((await register(cls.id)).status).toBe(401);
  });

  test('concurrent duplicate registration has one winner; concurrent conflicting assignments have one winner', async () => {
    const { coach, makeClass, register, assign } = await setup();
    const cls = await makeClass();
    expect((await Promise.all([register(cls.id), register(cls.id)])).map(({ status }) => status).sort()).toEqual([
      201, 409,
    ]);
    const second = await makeClass();
    expect(
      (await Promise.all([assign(cls.id, { coachId: coach.id }), assign(second.id, { coachId: coach.id })]))
        .map(({ status }) => status)
        .sort(),
    ).toEqual([200, 409]);
    expect(await prisma.class.count({ where: { coachId: coach.id } })).toBe(1);
  });

  test('withdrawal notifies enrolled members and manager, preserves history and money; started or non-owner returns error', async () => {
    const { manager, coach, other, member, makeClass } = await setup();
    const cls = await makeClass({
      status: 'OPEN',
      coachId: coach.id,
      approvedById: manager.id,
      approvedAt: new Date(),
    });
    const approved = await prisma.classCoachRegistration.create({
      data: { classId: cls.id, coachId: coach.id, source: 'COACH_REGISTERED', status: 'APPROVED' },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `WITHDRAW-${++sequence}`,
        idempotencyKey: `withdraw-${sequence}`,
        accountId: member.id,
        paymentMethod: 'WALLET',
        subtotal: 100000,
        totalAmount: 100000,
        receiptSnapshot: { schema_version: 1 },
        items: {
          create: {
            lineNumber: 1,
            type: 'COURSE_ENROLLMENT',
            subtotal: 100000,
            totalAmount: 100000,
            itemSnapshot: { schema_version: 1 },
          },
        },
      },
      include: { items: true },
    });
    const enrollment = await prisma.classEnrollment.create({
      data: { classId: cls.id, accountId: member.id, orderItemId: order.items[0]!.id },
    });
    expect((await request('POST', `/classes/${cls.id}/withdraw`, other)).status).toBe(403);
    const response = await request('POST', `/classes/${cls.id}/withdraw`, coach);
    expect(response.status).toBe(200);
    expect(await readResult<ClassDetail>(response)).toMatchObject({ status: 'PENDING_APPROVAL', coach: null });
    expect(await prisma.class.findUnique({ where: { id: cls.id } })).toMatchObject({
      approvedAt: null,
      approvedById: null,
    });
    expect(await prisma.classCoachRegistration.findUnique({ where: { id: approved.id } })).toMatchObject({
      status: 'APPROVED',
    });
    expect(await prisma.classEnrollment.findUnique({ where: { id: enrollment.id } })).toEqual(enrollment);
    expect(await prisma.walletTransaction.count()).toBe(0);
    const notice = await prisma.notification.findFirst({ where: { accountId: member.id } });
    expect(notice?.message).toContain('đang tìm HLV thay thế');
    expect(await prisma.notification.count({ where: { accountId: manager.id } })).toBe(1);
    const ongoing = await makeClass({ status: 'OPEN', coachId: coach.id }, 0);
    const denied = await request('POST', `/classes/${ongoing.id}/withdraw`, coach);
    expect([denied.status, await readCode(denied)]).toEqual([409, 'INVALID_STATE']);
  });

  test('coach lock releases future classes atomically, but ongoing class blocks all changes', async () => {
    const { manager, coach, other, makeClass, assign } = await setup();
    const future = await makeClass(
      { status: 'OPEN', coachId: coach.id, approvedById: manager.id, approvedAt: new Date() },
      6,
    );
    const ongoing = await makeClass({ status: 'OPEN', coachId: coach.id }, 0);
    const lock = () => request('PATCH', `/users/${coach.id}/status`, manager, { status: 'INACTIVE' });
    const blocked = await lock();
    expect([blocked.status, await readCode(blocked)]).toEqual([409, 'HAS_DEPENDENCIES']);
    expect(await prisma.account.findUnique({ where: { id: coach.id } })).toMatchObject({ status: 'ACTIVE' });
    expect(await prisma.class.findUnique({ where: { id: future.id } })).toMatchObject({
      coachId: coach.id,
      status: 'OPEN',
    });
    expect((await assign(ongoing.id, { coachId: other.id })).status).toBe(200);
    expect((await lock()).status).toBe(200);
    expect(await prisma.class.findUnique({ where: { id: future.id } })).toMatchObject({
      coachId: null,
      status: 'PENDING_APPROVAL',
      approvedAt: null,
    });
    expect(await prisma.notification.count({ where: { accountId: manager.id, referenceId: future.id } })).toBe(1);
  });
});
