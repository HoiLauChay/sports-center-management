import type { ClassSession, SessionDetail } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { ClassSession as SessionRow } from '~/generated/prisma/client';
import notificationService from '~/services/notification.service';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility } from './helpers/schedule';

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

  test('one student with a booking at a different facility blocks the move and leaves everything unchanged', async () => {
    const { manager, other, room, first } = await setup();
    // The second student is busy: checking only the first enrollment would miss this.
    await seedBooking(room.id, '18:30', '19:30', { date: date(5), accountId: other.id });
    const response = await request('PATCH', `/${first.id}`, manager, { date: date(5) });
    expect([response.status, await readCode(response)]).toEqual([409, 'SCHEDULE_CONFLICT']);
    await expectRollback(first.id, first);
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

describe('viewing class sessions', () => {
  test('reception lists the open sessions of a day; only the class coach or a manager opens one session', async () => {
    const { manager, member, cls, first } = await setup();
    const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
    const stranger = await createAccount('COACH', 'stranger@example.com');

    const day = await readResult<SessionDetail[]>(await request('GET', `?date=${date(3)}`, receptionist));
    expect(day).toEqual([
      expect.objectContaining({
        id: first.id,
        class: expect.objectContaining({ id: cls.id, enrolledCount: 2, maxStudents: cls.maxStudents }),
      }),
    ]);
    expect(await readResult<SessionDetail[]>(await request('GET', `?date=${date(4)}`, manager))).toEqual([]);

    const coach = { id: cls.coachId!, role: 'COACH' as const };
    expect(await readResult<SessionDetail>(await request('GET', `/${first.id}`, coach))).toMatchObject({
      id: first.id,
      date: date(3),
      class: { id: cls.id, coach: { id: cls.coachId } },
    });
    expect((await request('GET', `/${first.id}`, stranger)).status).toBe(403);
    expect((await request('GET', `/${first.id}`, member)).status).toBe(403);
  });
});
