import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import scheduleService, { type ConflictQuery } from '~/services/schedule.service';
import { parseTime, toCenterDateTime, toDbTime } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount } from './helpers/http';

const DAY = '2026-10-20';
const NOW = toCenterDateTime('2026-10-19', 12 * 60);
const at = (start: string, end: string, date = DAY) => ({ date, start: parseTime(start), end: parseTime(end) });

let seq = 0;

const facility = (capacityPerSlot: number, data: Record<string, unknown> = {}) =>
  prisma.facility.create({
    data: { name: `Sân ${++seq}`, type: 'COURT', capacityPerSlot, pricePerSlot: 100_000, ...data },
  });

const booking = async (facilityId: string, start: string, end: string, accountId?: string) => {
  const order = await prisma.order.create({
    data: {
      orderNumber: `DH261020TEST${String(++seq).padStart(2, '0')}`,
      idempotencyKey: `test:schedule:${seq}`,
      accountId: accountId ?? null,
      guestName: accountId ? null : 'Khách',
      guestPhone: accountId ? null : '0901234567',
      createdById: accountId ? null : (await createAccount('RECEPTIONIST', `r${seq}@example.com`)).id,
      receiptSnapshot: { schema_version: 1 },
      subtotal: 0,
      totalAmount: 0,
      paymentMethod: 'CASH',
      items: {
        create: {
          lineNumber: 1,
          type: 'FACILITY_BOOKING',
          itemSnapshot: { schema_version: 1 },
          subtotal: 0,
          totalAmount: 0,
        },
      },
    },
    include: { items: true },
  });
  return prisma.facilityBooking.create({
    data: {
      facilityId,
      accountId: accountId ?? null,
      orderItemId: order.items[0]!.id,
      bookingDate: new Date(DAY),
      startTime: toDbTime(parseTime(start)),
      endTime: toDbTime(parseTime(end)),
      unitPrice: 0,
    },
  });
};

const session = async (facilityId: string, start: string, end: string, extra: { coachId?: string } = {}) => {
  const sport = await prisma.sport.create({ data: { name: `Môn ${++seq}` } });
  const course = await prisma.course.create({ data: { name: 'Khóa', sportId: sport.id, totalSessions: 1, price: 0 } });
  const cls = await prisma.class.create({
    data: { name: `Lớp ${seq}`, courseId: course.id, facilityId, maxStudents: 10, weeklySchedule: [], ...extra },
  });
  return prisma.classSession.create({
    data: {
      classId: cls.id,
      facilityId,
      sessionNumber: 1,
      sessionDate: new Date(DAY),
      startTime: toDbTime(parseTime(start)),
      endTime: toDbTime(parseTime(end)),
    },
    include: { class: true },
  });
};

const reasons = async (query: Omit<ConflictQuery, 'now'>) =>
  (await scheduleService.findConflicts(prisma, { ...query, now: NOW })).map(
    ({ reason, startTime }) => `${startTime} ${reason}`,
  );

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('schedule conflicts', () => {
  test('a facility slot is closed, past, off grid, under maintenance or taken by a class', async () => {
    const court = await facility(1);
    const inactive = await facility(1, { isActive: false });
    await session(court.id, '18:00', '19:00');
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const maintenance = await prisma.facilityMaintenance.create({
      data: {
        facilityId: court.id,
        startAt: toCenterDateTime(DAY, parseTime('09:00')),
        endAt: toCenterDateTime(DAY, parseTime('10:30')),
        reason: 'Sơn sàn',
        createdById: manager.id,
      },
    });

    expect(await reasons({ facility: { id: inactive.id, exclusive: false }, ranges: [at('08:00', '09:00')] })).toEqual([
      '08:00 CLOSED',
    ]);
    expect(
      await reasons({
        facility: { id: court.id, exclusive: false },
        ranges: [
          at('08:00', '09:00', '2026-10-19'),
          at('08:30', '09:30'),
          at('10:00', '11:00'),
          at('18:00', '19:00'),
          at('20:00', '21:00'),
        ],
      }),
    ).toEqual(['08:00 PAST', '08:30 OFF_GRID', '10:00 MAINTENANCE', '18:00 CLASS_SESSION']);

    const [clash] = await scheduleService.findConflicts(prisma, {
      facility: { id: court.id, exclusive: false },
      ranges: [at('09:00', '10:00')],
      now: NOW,
    });
    expect(clash).toMatchObject({ reason: 'MAINTENANCE', maintenance: { id: maintenance.id, reason: 'Sơn sàn' } });
  });

  test('bookings fill capacity per slot; a class session needs the facility to itself', async () => {
    const gym = await facility(2);
    await booking(gym.id, '07:00', '08:00');
    await booking(gym.id, '08:00', '09:00');
    await booking(gym.id, '08:00', '09:00');

    expect(await reasons({ facility: { id: gym.id, exclusive: false }, ranges: [at('07:00', '09:00')] })).toEqual([
      '08:00 FULL',
    ]);
    expect(
      await reasons({
        facility: { id: gym.id, exclusive: false },
        ranges: [at('07:00', '08:00')],
        planned: [{ facilityId: gym.id, exclusive: false, ...at('07:00', '08:00') }],
      }),
    ).toEqual(['07:00 FULL']);
    expect(await reasons({ facility: { id: gym.id, exclusive: true }, ranges: [at('07:00', '08:00')] })).toEqual([
      '07:00 BOOKED',
    ]);
    expect(await reasons({ facility: { id: gym.id, exclusive: true }, ranges: [at('10:00', '11:00')] })).toEqual([]);
  });

  test('coach and member schedules clash across facilities; a moved session ignores itself', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    const roomA = await facility(10);
    const roomB = await facility(10);
    const taught = await session(roomA.id, '18:00', '19:00', { coachId: coach.id });
    const attended = await session(roomA.id, '06:00', '07:00');
    await prisma.classEnrollment.create({
      data: {
        classId: attended.classId,
        accountId: member.id,
        orderItemId: (await booking(roomB.id, '20:00', '21:00', member.id)).orderItemId,
      },
    });

    expect(await reasons({ coachId: coach.id, ranges: [at('18:00', '19:00')] })).toEqual(['18:00 COACH_BUSY']);
    expect(await reasons({ coachId: coach.id, ranges: [at('18:00', '19:00')], ignoreSessionIds: [taught.id] })).toEqual(
      [],
    );
    expect(
      await reasons({
        accountId: member.id,
        ranges: [at('06:00', '07:00'), at('20:00', '21:00'), at('09:00', '10:00')],
      }),
    ).toEqual(['06:00 MEMBER_BUSY', '20:00 MEMBER_BUSY']);

    const error = await scheduleService
      .assertAvailable(prisma, { coachId: coach.id, ranges: [at('18:00', '19:00')], now: NOW })
      .catch((err: unknown) => err);
    expect(error).toMatchObject({ code: 'SCHEDULE_CONFLICT', meta: { conflicts: [{ reason: 'COACH_BUSY' }] } });
  });
});
