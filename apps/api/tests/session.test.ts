import type { ClassSession } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { ClassSession as SessionRow } from '~/generated/prisma/client';
import notificationService from '~/services/notification.service';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility, seedSession } from './helpers/schedule';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
const emails = spyOn(notificationService, 'sendEmailsAfterCommit').mockImplementation(() => {});
beforeAll(async () => ({ server, request } = await startServer('/sessions')));
afterAll(() => {
  server.close();
  emails.mockRestore();
});
beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: { slotDurationMinutes: 30 } });
  emails.mockClear();
});
const date = (offset: number) => addDays(todayInCenter(), offset);
let seq = 0;

const enroll = async (classId: string, accountId: string, status: 'ENROLLED' | 'CANCELLED' = 'ENROLLED') => {
  const order = await prisma.order.create({
    data: {
      orderNumber: `SESSION-${++seq}`,
      idempotencyKey: `session-${seq}`,
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

const setup = async () => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const member = await createAccount('MEMBER', 'member@example.com');
  const other = await createAccount('MEMBER', 'other@example.com');
  const cls = await seedOpenClass();
  const course = await prisma.course.findUniqueOrThrow({ where: { id: cls.courseId } });
  await prisma.facilitySport.create({ data: { facilityId: cls.facilityId, sportId: course.sportId } });
  const room = await seedFacility(1, { sports: { create: { sportId: course.sportId } } });
  const sessions = await prisma.classSession.findMany({
    where: { classId: cls.id },
    orderBy: { sessionNumber: 'asc' },
  });
  await enroll(cls.id, member.id);
  await enroll(cls.id, other.id);
  return { manager, member, other, cls, room, sessions, first: sessions[0]!, last: sessions[1]! };
};

const expectRollback = async (id: string, before: SessionRow) => {
  expect(await prisma.classSession.findUnique({ where: { id } })).toEqual(before);
  expect(await prisma.notification.count()).toBe(0);
  expect(await prisma.auditLog.count()).toBe(0);
  expect(emails).not.toHaveBeenCalled();
};

describe('rescheduling a class session', () => {
  test('moves first and last sessions, recomputes chronological bounds, notifies coach and all active students without refund', async () => {
    const { manager, member, other, cls, room, first, last } = await setup();
    const balances = await prisma.memberProfile.findMany();
    const result = await readResult<ClassSession>(
      await request('PATCH', `/${first.id}`, manager, {
        date: date(4),
        startTime: '17:00',
        endTime: '18:30',
        facilityId: room.id,
      }),
    );
    expect(result).toMatchObject({ id: first.id, date: date(4), facility: { id: room.id }, status: 'SCHEDULED' });
    expect(await prisma.class.findUnique({ where: { id: cls.id } })).toMatchObject({
      startDate: new Date(date(4)),
      endDate: new Date(date(10)),
      facilityId: cls.facilityId,
    });
    const notices = await prisma.notification.findMany();
    expect(notices.map(({ accountId }) => accountId).sort()).toEqual([cls.coachId!, member.id, other.id].sort());
    expect(notices.every(({ referenceId, sendEmail }) => referenceId === cls.id && sendEmail)).toBe(true);
    expect(notices[0]!.message).toContain(room.name);
    expect(await prisma.auditLog.count()).toBe(2);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect(await prisma.memberProfile.findMany()).toEqual(balances);
    expect(await prisma.classEnrollment.count({ where: { status: 'ENROLLED' } })).toBe(2);

    expect((await request('PATCH', `/${last.id}`, manager, { date: date(2) })).status).toBe(200);
    expect(await prisma.class.findUnique({ where: { id: cls.id } })).toMatchObject({
      startDate: new Date(date(2)),
      endDate: new Date(date(4)),
    });
  });

  test('room-only edit ignores itself; an identical retry creates no extra audit or notice', async () => {
    const { manager, room, first } = await setup();
    expect((await request('PATCH', `/${first.id}`, manager, { facilityId: room.id })).status).toBe(200);
    expect((await request('PATCH', `/${first.id}`, manager, { facilityId: room.id })).status).toBe(200);
    expect(await prisma.auditLog.count()).toBe(1);
    expect(await prisma.notification.count()).toBe(3);
  });

  test('one student with a booking at a different facility blocks the move and leaves everything unchanged', async () => {
    const { manager, other, room, first } = await setup();
    // The second student is busy: checking only the first enrollment would miss this.
    await seedBooking(room.id, '18:30', '19:30', { date: date(5), accountId: other.id });
    const response = await request('PATCH', `/${first.id}`, manager, { date: date(5) });
    expect([response.status, await readCode(response)]).toEqual([409, 'SCHEDULE_CONFLICT']);
    await expectRollback(first.id, first);
  });

  test('a student enrolled in another class blocks the move', async () => {
    const { manager, other, room, first } = await setup();
    const busy = await seedSession(room.id, '18:30', '20:00', { date: date(5) });
    await enroll(busy.classId, other.id);
    expect((await request('PATCH', `/${first.id}`, manager, { date: date(5) })).status).toBe(409);
    await expectRollback(first.id, first);
  });

  test('cancelled enrollment is ignored for conflicts and notifications; touching time boundaries is allowed', async () => {
    const { manager, member, other, room, first } = await setup();
    await prisma.classEnrollment.updateMany({ where: { accountId: other.id }, data: { status: 'CANCELLED' } });
    await seedBooking(room.id, '18:00', '19:30', { date: date(5), accountId: other.id });
    expect((await request('PATCH', `/${first.id}`, manager, { date: date(5) })).status).toBe(200);
    expect(await prisma.notification.count({ where: { accountId: other.id } })).toBe(0);
    await seedBooking(room.id, '19:30', '20:00', { date: date(6), accountId: member.id });
    expect((await request('PATCH', `/${first.id}`, manager, { date: date(6) })).status).toBe(200);
  });

  test('facility bookings, other sessions, maintenance and coach conflicts return 409', async () => {
    const { manager, cls, room, first } = await setup();
    await seedBooking(cls.facilityId, '18:00', '19:30', { date: date(5) });
    await seedSession(cls.facilityId, '18:00', '19:30', { date: date(6) });
    await seedSession(room.id, '18:00', '19:30', { date: date(7), coachId: cls.coachId! });
    await prisma.facilityMaintenance.create({
      data: {
        facilityId: cls.facilityId,
        reason: 'Bảo trì',
        createdById: manager.id,
        startAt: new Date(`${date(8)}T10:00:00Z`),
        endAt: new Date(`${date(8)}T13:00:00Z`),
      },
    });
    for (const offset of [5, 6, 7, 8]) {
      const response = await request('PATCH', `/${first.id}`, manager, { date: date(offset) });
      expect([response.status, await readCode(response)]).toEqual([409, 'SCHEDULE_CONFLICT']);
    }
    await expectRollback(first.id, first);
  });

  test('checks effective partial times, slot grid and facility sport support; refuses cancellation fields and empty patches', async () => {
    const { manager, first } = await setup();
    const unsupported = await seedFacility(1);
    for (const body of [
      {},
      { status: 'CANCELLED' },
      { startTime: '20:00' },
      { date: 'bad' },
      { facilityId: unsupported.id },
    ]) {
      expect((await request('PATCH', `/${first.id}`, manager, body)).status).toBe(422);
    }
    expect((await request('PATCH', `/${first.id}`, manager, { startTime: '18:05' })).status).toBe(409);
    await expectRollback(first.id, first);
  });

  test('only manager can edit; missing, cancelled or past sessions are rejected', async () => {
    const { manager, member, first, cls } = await setup();
    for (const role of ['COACH', 'RECEPTIONIST'] as const) {
      const viewer = await createAccount(role, `${role}@example.com`);
      expect((await request('PATCH', `/${first.id}`, viewer, { date: date(5) })).status).toBe(403);
    }
    expect((await request('PATCH', `/${first.id}`, member, { date: date(5) })).status).toBe(403);
    expect((await request('PATCH', `/${crypto.randomUUID()}`, manager, { date: date(5) })).status).toBe(404);
    await prisma.classSession.update({ where: { id: first.id }, data: { sessionDate: new Date(date(-1)) } });
    expect((await request('PATCH', `/${first.id}`, manager, { date: date(5) })).status).toBe(409);
    await prisma.classSession.update({
      where: { id: first.id },
      data: { sessionDate: new Date(date(3)), status: 'CANCELLED' },
    });
    expect((await request('PATCH', `/${first.id}`, manager, { date: date(5) })).status).toBe(409);
    await prisma.classSession.update({ where: { id: first.id }, data: { status: 'SCHEDULED' } });
    await prisma.class.update({ where: { id: cls.id }, data: { status: 'CANCELLED' } });
    expect((await request('PATCH', `/${first.id}`, manager, { date: date(5) })).status).toBe(409);
  });

  test('two simultaneous moves to the same facility slot: exactly one succeeds', async () => {
    const { manager, room, first, last } = await setup();
    const results = await Promise.all(
      [first, last].map(({ id }) => request('PATCH', `/${id}`, manager, { date: date(5), facilityId: room.id })),
    );
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(await prisma.notification.count()).toBe(3);
    expect(await prisma.classSession.count({ where: { facilityId: room.id, sessionDate: new Date(date(5)) } })).toBe(1);
  });
});
