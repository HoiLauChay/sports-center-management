import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import type { SessionConflict, SystemSettings } from '@sports-center/shared';
import { prisma } from '~/configs/db';
import { todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let manager: Viewer;
let member: Viewer;

beforeAll(async () => {
  ({ server, request } = await startServer('/settings'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
  manager = await createAccount('MANAGER', 'manager@example.com');
  member = await createAccount('MEMBER', 'member@example.com');
});

const dayFromToday = (days: number) => new Date(Date.parse(todayInCenter()) + days * 24 * 60 * 60 * 1000);
const time = (value: string) => new Date(`1970-01-01T${value}:00Z`);

const createSession = async (sessionNumber: number, date: Date, status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED') => {
  const facility =
    (await prisma.facility.findFirst()) ??
    (await prisma.facility.create({
      data: { name: 'Sân 1', type: 'COURT', capacityPerSlot: 4, pricePerSlot: 100000 },
    }));
  const sport = (await prisma.sport.findFirst()) ?? (await prisma.sport.create({ data: { name: 'Cầu lông' } }));
  const course =
    (await prisma.course.findFirst()) ??
    (await prisma.course.create({ data: { name: 'Cơ bản', sportId: sport.id, totalSessions: 10, price: 0 } }));
  const cls =
    (await prisma.class.findFirst()) ??
    (await prisma.class.create({
      data: { courseId: course.id, facilityId: facility.id, name: 'Lớp sáng', maxStudents: 10, weeklySchedule: [] },
    }));
  return prisma.classSession.create({
    data: {
      classId: cls.id,
      facilityId: facility.id,
      sessionNumber,
      sessionDate: date,
      startTime: time('07:00'),
      endTime: time('08:00'),
      status,
    },
  });
};

describe('system settings', () => {
  test('everyone reads settings but only the manager can change them', async () => {
    const read = await request('GET', '/', member);
    expect(read.status).toBe(200);
    expect(await readResult<SystemSettings>(read)).toMatchObject({ openTime: '06:00', closeTime: '22:00' });

    expect((await request('PATCH', '/', member, { maxAdvanceBookingDays: 14 })).status).toBe(403);

    const updated = await request('PATCH', '/', manager, { maxAdvanceBookingDays: 14, topUpMinAmount: 50000 });
    expect(updated.status).toBe(200);
    expect(await readResult<SystemSettings>(updated)).toMatchObject({
      maxAdvanceBookingDays: 14,
      topUpMinAmount: 50000,
    });
    expect(await prisma.auditLog.count({ where: { entityType: 'SYSTEM_SETTING', action: 'UPDATE' } })).toBe(1);
  });

  test('open time must be before close time, also against the stored value', async () => {
    const both = await request('PATCH', '/', manager, { openTime: '20:00', closeTime: '08:00' });
    expect(both.status).toBe(422);

    const openOnly = await request('PATCH', '/', manager, { openTime: '22:00' });
    expect(openOnly.status).toBe(422);
    expect(await readCode(openOnly)).toBe('VALIDATION_ERROR');
  });

  test('changing the grid is rejected while upcoming sessions would fall off it', async () => {
    const upcoming = await createSession(1, dayFromToday(1));
    await createSession(2, dayFromToday(-1));
    await createSession(3, dayFromToday(2), 'CANCELLED');

    const conflict = await request('PATCH', '/', manager, { slotDurationMinutes: 90 });
    expect(conflict.status).toBe(409);
    const body = (await conflict.json()) as { code: string; sessions: SessionConflict[]; bookings: unknown[] };
    expect(body.code).toBe('SCHEDULE_CONFLICT');
    expect(body.sessions.map(({ id }) => id)).toEqual([upcoming.id]);
    expect(body.sessions[0]).toMatchObject({ className: 'Lớp sáng', startTime: '07:00', endTime: '08:00' });
    expect((await prisma.systemSetting.findUniqueOrThrow({ where: { id: 1 } })).slotDurationMinutes).toBe(60);

    expect((await request('PATCH', '/', manager, { slotDurationMinutes: 30 })).status).toBe(200);
  });
});
