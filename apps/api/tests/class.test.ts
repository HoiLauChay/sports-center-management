import type { ClassDetail } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import scheduleService from '~/services/schedule.service';
import sportService from '~/services/sport.service';
import { parseTime } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/classes'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const TUESDAY = '2027-03-02';
const tueThu = [
  { dayOfWeek: 4, startTime: '18:00', endTime: '19:00' },
  { dayOfWeek: 2, startTime: '18:00', endTime: '19:00' },
];

const setup = async () => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const boxing = await prisma.sport.create({ data: { name: 'Boxing' } });
  const yoga = await prisma.sport.create({ data: { name: 'Yoga' } });
  const course = await prisma.course.create({
    data: { name: 'Boxing cơ bản', sportId: boxing.id, totalSessions: 12, price: 1_200_000 },
  });
  const room = await prisma.facility.create({
    data: {
      name: 'Phòng Boxing 1',
      type: 'ROOM',
      capacityPerSlot: 20,
      pricePerSlot: 100_000,
      sports: { create: [{ sportId: boxing.id }] },
    },
  });
  const yogaRoom = await prisma.facility.create({
    data: {
      name: 'Phòng Yoga',
      type: 'ROOM',
      capacityPerSlot: 20,
      pricePerSlot: 100_000,
      sports: { create: [{ sportId: yoga.id }] },
    },
  });
  const body = {
    courseId: course.id,
    name: 'Boxing tối T3/T5',
    facilityId: room.id,
    startDate: TUESDAY,
    weeklySchedule: tueThu,
    maxStudents: 20,
  };
  return { manager, boxing, course, room, yogaRoom, body };
};

const errorOf = async (response: Response) =>
  (await response.json()) as {
    code: string;
    errors?: { path: string }[];
    conflicts?: { reason: string; date: string }[];
  };

describe('classes', () => {
  test('a Tuesday/Thursday schedule of 12 sessions creates a draft class with 12 dated sessions', async () => {
    const { manager, body } = await setup();

    const response = await request('POST', '/', manager, body);
    expect(response.status).toBe(201);
    const created = await readResult<ClassDetail>(response);

    expect(created).toMatchObject({
      status: 'DRAFT',
      derivedStatus: null,
      startDate: TUESDAY,
      endDate: '2027-04-08',
      coach: null,
      enrolledCount: 0,
      weeklySchedule: [tueThu[1], tueThu[0]],
    });
    expect(
      created.sessions.map(({ sessionNumber, date, startTime }) => `${sessionNumber} ${date} ${startTime}`),
    ).toEqual([
      '1 2027-03-02 18:00',
      '2 2027-03-04 18:00',
      '3 2027-03-09 18:00',
      '4 2027-03-11 18:00',
      '5 2027-03-16 18:00',
      '6 2027-03-18 18:00',
      '7 2027-03-23 18:00',
      '8 2027-03-25 18:00',
      '9 2027-03-30 18:00',
      '10 2027-04-01 18:00',
      '11 2027-04-06 18:00',
      '12 2027-04-08 18:00',
    ]);
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS', action: 'CREATE' } })).toBe(1);
  });

  test('sessions of a draft class block bookings and other classes in the same slots', async () => {
    const { manager, room, body } = await setup();
    await request('POST', '/', manager, body);

    const booking = await scheduleService.findConflicts(prisma, {
      facility: { id: room.id, exclusive: false },
      ranges: [{ date: TUESDAY, start: parseTime('18:00'), end: parseTime('19:00') }],
    });
    expect(booking.map(({ reason }) => reason)).toEqual(['CLASS_SESSION']);

    const overlapping = await request('POST', '/', manager, {
      ...body,
      name: 'Lớp trùng',
      startDate: '2027-03-30',
      weeklySchedule: [{ dayOfWeek: 2, startTime: '18:00', endTime: '20:00' }],
    });
    expect(overlapping.status).toBe(409);
    const error = await errorOf(overlapping);
    expect(error.code).toBe('SCHEDULE_CONFLICT');
    expect(error.conflicts?.map(({ date, reason }) => `${date} ${reason}`)).toEqual([
      '2027-03-30 CLASS_SESSION',
      '2027-04-06 CLASS_SESSION',
    ]);
    expect(await prisma.class.count()).toBe(1);
  });

  test('inactive sports, unsupported facilities and off-grid times are rejected; a sport switched off meanwhile never ends up with a class', async () => {
    const { manager, boxing, course, yogaRoom, body } = await setup();

    const offGrid = await request('POST', '/', manager, {
      ...body,
      weeklySchedule: [{ dayOfWeek: 2, startTime: '18:30', endTime: '19:30' }],
    });
    expect((await errorOf(offGrid)).conflicts?.[0]?.reason).toBe('OFF_GRID');
    expect(
      (await errorOf(await request('POST', '/', manager, { ...body, facilityId: yogaRoom.id }))).errors?.map(
        ({ path }) => path,
      ),
    ).toEqual(['body.facilityId']);

    const [created] = await Promise.all([
      request('POST', '/', manager, body),
      sportService.update(manager.id, boxing.id, { isActive: false }).catch((err: unknown) => err),
    ]);
    const sport = await prisma.sport.findUniqueOrThrow({ where: { id: boxing.id } });
    if (created.status === 201) {
      expect(sport.isActive).toBe(true);
    } else {
      expect(sport.isActive).toBe(false);
      expect((await errorOf(created)).errors?.map(({ path }) => path)).toEqual(['body.courseId']);
    }
    expect(await prisma.class.count({ where: { courseId: course.id } })).toBe(created.status === 201 ? 1 : 0);
  });
});
