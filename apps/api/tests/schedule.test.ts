import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import scheduleService, { type ConflictQuery } from '~/services/schedule.service';
import { parseTime, toCenterDateTime } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount } from './helpers/http';
import { SEED_DAY, seedBooking, seedFacility, seedSession } from './helpers/schedule';

const DAY = SEED_DAY;
const NOW = toCenterDateTime('2026-10-19', 12 * 60);
const at = (start: string, end: string, date = DAY) => ({ date, start: parseTime(start), end: parseTime(end) });

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
    const court = await seedFacility(1);
    const inactive = await seedFacility(1, { isActive: false });
    await seedSession(court.id, '18:00', '19:00');
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
    const gym = await seedFacility(2);
    await seedBooking(gym.id, '07:00', '08:00');
    await seedBooking(gym.id, '08:00', '09:00');
    await seedBooking(gym.id, '08:00', '09:00');

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
    const roomA = await seedFacility(10);
    const roomB = await seedFacility(10);
    const taught = await seedSession(roomA.id, '18:00', '19:00', { coachId: coach.id });
    const attended = await seedSession(roomA.id, '06:00', '07:00');
    await prisma.classEnrollment.create({
      data: {
        classId: attended.classId,
        accountId: member.id,
        orderItemId: (await seedBooking(roomB.id, '20:00', '21:00', { accountId: member.id })).orderItemId,
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
