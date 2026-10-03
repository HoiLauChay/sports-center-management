import type { FacilitySchedule } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { parseTime, toCenterDateTime } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility, seedSession } from './helpers/schedule';

const DATE = '2030-01-15';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/facilities'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({
    data: { openTime: new Date('1970-01-01T06:00:00Z'), closeTime: new Date('1970-01-01T12:00:00Z') },
  });
});

const statuses = (schedule: FacilitySchedule) =>
  Object.fromEntries(schedule.slots.map(({ startTime, status, booked }) => [startTime, `${status} ${booked}`]));

describe('facility schedule', () => {
  test('each slot shows its status; a class slot stays CLASS even with capacity left', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const gym = await seedFacility(2);
    await seedBooking(gym.id, '07:00', '08:00', { date: DATE });
    await seedBooking(gym.id, '08:00', '09:00', { date: DATE });
    await seedBooking(gym.id, '08:00', '09:00', { date: DATE });
    await seedSession(gym.id, '09:00', '10:00', { date: DATE });
    await prisma.facilityMaintenance.create({
      data: {
        facilityId: gym.id,
        startAt: toCenterDateTime(DATE, parseTime('10:00')),
        endAt: toCenterDateTime(DATE, parseTime('11:00')),
        reason: 'Bảo dưỡng máy',
        createdById: manager.id,
      },
    });

    const schedule = await readResult<FacilitySchedule>(
      await request('GET', `/${gym.id}/schedule?date=${DATE}`, member),
    );
    expect(schedule.facility).toEqual({ id: gym.id, name: gym.name, capacityPerSlot: 2 });
    expect(statuses(schedule)).toEqual({
      '06:00': 'AVAILABLE 0',
      '07:00': 'PARTIAL 1',
      '08:00': 'FULL 2',
      '09:00': 'CLASS 0',
      '10:00': 'MAINTENANCE 0',
      '11:00': 'AVAILABLE 0',
    });
    expect(schedule.slots.find(({ status }) => status === 'MAINTENANCE')?.maintenance?.reason).toBe('Bảo dưỡng máy');

    const past = await readResult<FacilitySchedule>(
      await request('GET', `/${gym.id}/schedule?date=2020-01-01`, member),
    );
    expect(new Set(past.slots.map(({ status }) => status))).toEqual(new Set(['CLOSED']));

    await prisma.facility.update({ where: { id: gym.id }, data: { isActive: false } });
    const inactive = await readResult<FacilitySchedule>(
      await request('GET', `/${gym.id}/schedule?date=${DATE}`, member),
    );
    expect(new Set(inactive.slots.map(({ status }) => status))).toEqual(new Set(['CLOSED']));

    await prisma.facility.update({ where: { id: gym.id }, data: { deletedAt: new Date() } });
    expect((await request('GET', `/${gym.id}/schedule?date=${DATE}`, member)).status).toBe(404);
    expect((await request('GET', `/${gym.id}/schedule`, member)).status).toBe(422);
  });
});
