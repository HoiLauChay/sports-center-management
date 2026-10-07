import type { ClassDetail, ClassSummary, Paginated } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { Prisma, Role } from '~/generated/prisma/client';
import notificationService from '~/services/notification.service';
import scheduleService from '~/services/schedule.service';
import { formatDate, toDbTime, todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { seedBooking } from './helpers/schedule';

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
  (await readResult<Paginated<ClassSummary>>(await request('GET', `/${query}`, viewer))).items.map(({ name }) => name);

describe('class viewing, editing and review', () => {
  test('cancellation frees the slot for booking, notifies only the coach and active students, and retains purchase history', async () => {
    const { manager, member, other, coach, room, makeClass, enroll } = await setup();
    await prisma.systemSetting.create({ data: {} });
    const cls = await makeClass();
    const enrollment = await enroll(cls.id);
    await enroll(cls.id, other.id, 'CANCELLED');
    const date = formatDate(day(2));
    const query = { facility: { id: room.id, exclusive: false }, ranges: [{ date, start: 360, end: 420 }] };
    expect((await scheduleService.findConflicts(prisma, query)).map(({ reason }) => reason)).toEqual(['CLASS_SESSION']);
    const response = await request('POST', `/${cls.id}/cancel`, manager, { reason: '  HLV nghỉ  ' });
    expect(response.status).toBe(200);
    const result = await readResult<ClassDetail>(response);
    expect(result).toMatchObject({ status: 'CANCELLED', cancelReason: 'HLV nghỉ' });
    expect(result.sessions[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'HLV nghỉ' });
    expect(await scheduleService.findConflicts(prisma, query)).toEqual([]);
    expect(
      (await scheduleService.facilityDay(room.id, date))!.slots.find(({ startTime }) => startTime === '06:00')?.status,
    ).toBe('AVAILABLE');
    await seedBooking(room.id, '06:00', '07:00', { date, accountId: member.id });
    expect(
      (await scheduleService.facilityDay(room.id, date))!.slots.find(({ startTime }) => startTime === '06:00')?.status,
    ).toBe('FULL');
    const notices = await prisma.notification.findMany({ where: { referenceId: cls.id } });
    expect(notices.map(({ accountId }) => accountId).sort()).toEqual([coach.id, member.id].sort());
    expect(notices.every(({ message, sendEmail }) => message.includes('HLV nghỉ') && sendEmail)).toBe(true);
    expect(emails).toHaveBeenCalledTimes(1);
    expect(await prisma.classEnrollment.findUnique({ where: { id: enrollment.id } })).toMatchObject({
      status: 'ENROLLED',
    });
    expect(await prisma.orderItem.findUnique({ where: { id: enrollment.orderItemId } })).toMatchObject({
      refundedAt: null,
    });
    expect((await request('GET', `/${cls.id}`, member)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityId: cls.id, entityType: 'CLASS', action: 'UPDATE' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS_SESSION', action: 'UPDATE' } })).toBe(1);
  });

  test('draft and pending classes can be cancelled; a started class keeps past and previously cancelled sessions', async () => {
    const { manager, room, makeClass } = await setup();
    for (const status of ['DRAFT', 'PENDING_APPROVAL'] as const) {
      const cls = await makeClass({ status, coachId: null });
      expect((await request('POST', `/${cls.id}/cancel`, manager, { reason: 'Không mở lớp' })).status).toBe(200);
    }
    const cls = await makeClass({ startDate: day(-2) });
    await prisma.classSession.createMany({
      data: [
        {
          classId: cls.id,
          facilityId: room.id,
          sessionNumber: 2,
          sessionDate: day(-2),
          startTime: toDbTime(360),
          endTime: toDbTime(420),
        },
        {
          classId: cls.id,
          facilityId: room.id,
          sessionNumber: 3,
          sessionDate: day(3),
          startTime: toDbTime(360),
          endTime: toDbTime(420),
          status: 'CANCELLED',
          cancelReason: 'Lý do cũ',
        },
      ],
    });
    const result = await readResult<ClassDetail>(
      await request('POST', `/${cls.id}/cancel`, manager, { reason: 'Dừng lớp' }),
    );
    expect(result.sessions.map(({ status, cancelReason }) => [status, cancelReason])).toEqual([
      ['CANCELLED', 'Dừng lớp'],
      ['SCHEDULED', null],
      ['CANCELLED', 'Lý do cũ'],
    ]);
  });

  test('cancellation requires manager, valid id and reason; missing and deleted classes return 404', async () => {
    const { manager, member, coach, makeClass } = await setup();
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const cls = await makeClass();
    for (const viewer of [member, coach, receptionist]) {
      expect((await request('POST', `/${cls.id}/cancel`, viewer, { reason: 'Hủy' })).status).toBe(403);
    }
    for (const body of [{}, { reason: ' ' }, { reason: 'x'.repeat(501) }]) {
      expect((await request('POST', `/${cls.id}/cancel`, manager, body)).status).toBe(422);
    }
    expect((await request('POST', '/invalid/cancel', manager, { reason: 'Hủy' })).status).toBe(422);
    expect((await request('POST', `/${crypto.randomUUID()}/cancel`, manager, { reason: 'Hủy' })).status).toBe(404);
    await prisma.class.update({ where: { id: cls.id }, data: { deletedAt: new Date() } });
    expect((await request('POST', `/${cls.id}/cancel`, manager, { reason: 'Hủy' })).status).toBe(404);
    expect(await prisma.notification.count()).toBe(0);
  });

  test('simultaneous and repeated cancellation produce one change and one batch of notices', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass();
    const results = await Promise.all([
      request('POST', `/${cls.id}/cancel`, manager, { reason: 'A' }),
      request('POST', `/${cls.id}/cancel`, manager, { reason: 'B' }),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect((await request('POST', `/${cls.id}/cancel`, manager, { reason: 'C' })).status).toBe(409);
    expect(await prisma.notification.count({ where: { referenceId: cls.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: cls.id, entityType: 'CLASS' } })).toBe(1);
    expect(emails).toHaveBeenCalledTimes(1);
  });

  test('failure to persist notifications rolls back the class, sessions and audits', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass();
    const failure = spyOn(notificationService, 'create').mockRejectedValueOnce(new Error('notification failure'));
    try {
      expect((await request('POST', `/${cls.id}/cancel`, manager, { reason: 'Hủy' })).status).toBe(500);
    } finally {
      failure.mockRestore();
    }
    expect(await prisma.class.findUnique({ where: { id: cls.id } })).toMatchObject({
      status: 'OPEN',
      cancelReason: null,
    });
    expect(await prisma.classSession.count({ where: { classId: cls.id, status: 'SCHEDULED' } })).toBe(1);
    expect(await prisma.auditLog.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(emails).not.toHaveBeenCalled();
  });

  test('a member sees the enrollment catalog, full classes included, plus classes bought; staff never see drafts unless manager', async () => {
    const { manager, member, other, makeClass, enroll } = await setup();
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    await makeClass({ name: 'Mở' });
    const full = await makeClass({ name: 'Đầy', minStudents: 1, maxStudents: 1 });
    await enroll(full.id, other.id);
    const started = await makeClass({ name: 'Đang học', startDate: day(-1) });
    const cancelled = await makeClass({ name: 'Đã hủy', status: 'CANCELLED' });
    const draft = await makeClass({ name: 'Nháp', status: 'DRAFT', coachId: null });
    await makeClass({ name: 'Chờ duyệt', status: 'PENDING_APPROVAL' });
    await enroll(cancelled.id);
    await enroll(started.id, other.id);

    expect((await list(member)).sort()).toEqual(['Mở', 'Đầy', 'Đã hủy'].sort());
    expect((await list(member, '?openForEnrollment=true')).sort()).toEqual(['Mở', 'Đầy'].sort());
    expect((await request('GET', `/${started.id}`, member)).status).toBe(404);
    expect((await readResult<ClassDetail>(await request('GET', `/${cancelled.id}`, member))).sessions).toHaveLength(1);
    expect(await list(receptionist)).not.toContain('Nháp');
    expect((await request('GET', `/${draft.id}`, receptionist)).status).toBe(404);
    expect(await list(manager)).toHaveLength(6);
  });

  test('a class is edited only before it starts and never below its current enrollment', async () => {
    const { manager, makeClass, enroll } = await setup();
    const cls = await makeClass();
    await enroll(cls.id);

    const edited = await request('PATCH', `/${cls.id}`, manager, { name: 'Tên mới', maxStudents: 5 });
    expect(await readResult<ClassDetail>(edited)).toMatchObject({ name: 'Tên mới', maxStudents: 5, minStudents: 2 });
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS', action: 'UPDATE' } })).toBe(1);

    const below = await request('PATCH', `/${cls.id}`, manager, { minStudents: 1, maxStudents: 1 });
    expect(below.status).toBe(200);
    await enroll(cls.id, (await createAccount('MEMBER', 'late@example.com')).id);
    expect((await request('PATCH', `/${cls.id}`, manager, { maxStudents: 1 })).status).toBe(409);

    const startsToday = await makeClass({ startDate: day(0) });
    expect((await request('PATCH', `/${startsToday.id}`, manager, { name: 'X' })).status).toBe(409);
  });

  test('approval needs a qualified coach; rejection sends the class back to draft without its coach', async () => {
    const { manager, coach, makeClass } = await setup();
    const coachless = await makeClass({ status: 'PENDING_APPROVAL', coachId: null });
    const missing = await request('POST', `/${coachless.id}/approve`, manager, {});
    expect([missing.status, await readCode(missing)]).toEqual([409, 'CONFLICT']);

    const approved = await readResult<ClassDetail>(
      await request('POST', `/${(await makeClass({ status: 'PENDING_APPROVAL' })).id}/approve`, manager, {}),
    );
    expect(approved).toMatchObject({ status: 'OPEN', coach: { id: coach.id } });

    const pending = await makeClass({ status: 'PENDING_APPROVAL' });
    const rejected = await readResult<ClassDetail>(
      await request('POST', `/${pending.id}/reject`, manager, { note: 'Lịch chưa phù hợp' }),
    );
    expect(rejected).toMatchObject({ status: 'DRAFT', coach: null });
    const notices = await prisma.notification.findMany({
      where: { accountId: coach.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(notices.map(({ title }) => title)).toEqual(['Lớp học đã được duyệt', 'Lớp học bị từ chối']);
    expect(notices[1]!.message).toContain('Lịch chưa phù hợp');
    expect(emails).toHaveBeenCalledTimes(2);
  });

  test('approve and reject at the same time: exactly one wins', async () => {
    const { manager, makeClass } = await setup();
    const cls = await makeClass({ status: 'PENDING_APPROVAL' });
    const results = await Promise.all([
      request('POST', `/${cls.id}/approve`, manager, {}),
      request('POST', `/${cls.id}/reject`, manager, {}),
    ]);
    expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS', entityId: cls.id } })).toBe(1);
  });
});
