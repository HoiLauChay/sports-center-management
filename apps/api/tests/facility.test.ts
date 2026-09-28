import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import type { Facility } from '@sports-center/shared';
import { prisma } from '~/configs/db';
import { todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let manager: Viewer;
let member: Viewer;

beforeAll(async () => {
  ({ server, request } = await startServer('/facilities'));
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  manager = await createAccount('MANAGER', 'manager@example.com');
  member = await createAccount('MEMBER', 'member@example.com');
});

const createSport = (name: string, data: { isActive?: boolean; deletedAt?: Date } = {}) =>
  prisma.sport.create({ data: { name, ...data } });

const facilityBody = (name: string, sportIds: string[] = [], extra: Record<string, unknown> = {}) => ({
  name,
  type: 'COURT',
  capacityPerSlot: 4,
  pricePerSlot: 120000,
  sportIds,
  ...extra,
});

const createFacility = async (name: string, sportIds: string[] = [], extra: Record<string, unknown> = {}) => {
  const res = await request('POST', '/', manager, facilityBody(name, sportIds, extra));
  expect(res.status).toBe(201);
  return readResult<Facility>(res);
};

const scheduleSession = async (facilityId: string, sportId: string) => {
  const course = await prisma.course.create({ data: { name: 'Khóa', sportId, totalSessions: 1, price: 0 } });
  const cls = await prisma.class.create({
    data: { courseId: course.id, facilityId, name: 'Lớp tối', maxStudents: 10, weeklySchedule: [] },
  });
  return prisma.classSession.create({
    data: {
      classId: cls.id,
      facilityId,
      sessionNumber: 1,
      sessionDate: new Date(Date.parse(todayInCenter()) + 24 * 60 * 60 * 1000),
      startTime: new Date('1970-01-01T18:00:00Z'),
      endTime: new Date('1970-01-01T19:00:00Z'),
    },
  });
};

describe('facility management', () => {
  test('filters by type, sport and status; non-managers only see active facilities', async () => {
    const badminton = await createSport('Cầu lông');
    const swimming = await createSport('Bơi');
    await createFacility('Sân 1', [badminton.id]);
    await createFacility('Hồ bơi', [swimming.id], { type: 'ROOM' });
    await createFacility('Sân 2', [badminton.id], { isActive: false });

    const names = async (viewer: Viewer, query: string) =>
      (await readResult<Facility[]>(await request('GET', query, viewer))).map(({ name }) => name);

    expect(await names(manager, '/')).toEqual(['Hồ bơi', 'Sân 1', 'Sân 2']);
    expect(await names(manager, '/?type=ROOM')).toEqual(['Hồ bơi']);
    expect(await names(manager, `/?sportId=${badminton.id}`)).toEqual(['Sân 1', 'Sân 2']);
    expect(await names(manager, '/?isActive=false')).toEqual(['Sân 2']);
    expect(await names(member, '/?isActive=false')).toEqual(['Hồ bơi', 'Sân 1']);
    expect((await request('POST', '/', member, facilityBody('Sân 3'))).status).toBe(403);
  });

  test('rejects inactive or deleted sports and hides deleted sports from the list', async () => {
    const badminton = await createSport('Cầu lông');
    const tennis = await createSport('Tennis');
    const inactive = await createSport('Bóng rổ', { isActive: false });
    const deleted = await createSport('Bóng chuyền', { deletedAt: new Date() });

    for (const sportId of [inactive.id, deleted.id]) {
      const res = await request('POST', '/', manager, facilityBody('Sân A', [badminton.id, sportId]));
      expect(res.status).toBe(422);
      expect(((await res.json()) as { errors: { path: string }[] }).errors[0]?.path).toBe('body.sportIds');
    }

    const facility = await createFacility('Sân A', [badminton.id, tennis.id]);
    const addInactive = await request('PATCH', `/${facility.id}`, manager, { sportIds: [badminton.id, inactive.id] });
    expect(addInactive.status).toBe(422);

    await prisma.sport.update({ where: { id: tennis.id }, data: { deletedAt: new Date() } });
    const [listed] = await readResult<Facility[]>(await request('GET', '/', member));
    expect(listed?.sports.map(({ name }) => name)).toEqual(['Cầu lông']);
  });

  test('names are unique regardless of letter case', async () => {
    await createFacility('Sân 1');
    const duplicate = await request('POST', '/', manager, facilityBody('sân 1'));
    expect(duplicate.status).toBe(409);
    expect(await readCode(duplicate)).toBe('NAME_TAKEN');

    const other = await createFacility('Sân 2');
    const rename = await request('PATCH', `/${other.id}`, manager, { name: 'SÂN 1' });
    expect(rename.status).toBe(409);
    expect(await readCode(rename)).toBe('NAME_TAKEN');
  });

  test('cannot remove a sport or delete a facility that still has upcoming sessions', async () => {
    const badminton = await createSport('Cầu lông');
    const tennis = await createSport('Tennis');
    const facility = await createFacility('Sân 1', [badminton.id, tennis.id]);
    await scheduleSession(facility.id, badminton.id);

    const removeSport = await request('PATCH', `/${facility.id}`, manager, { sportIds: [tennis.id] });
    expect(removeSport.status).toBe(409);
    expect(await readCode(removeSport)).toBe('HAS_DEPENDENCIES');

    const removeOther = await request('PATCH', `/${facility.id}`, manager, { sportIds: [badminton.id] });
    expect(removeOther.status).toBe(200);
    expect((await readResult<Facility>(removeOther)).sports.map(({ name }) => name)).toEqual(['Cầu lông']);

    const remove = await request('DELETE', `/${facility.id}`, manager);
    expect(remove.status).toBe(409);
    expect(await readCode(remove)).toBe('HAS_DEPENDENCIES');

    const empty = await createFacility('Sân 2');
    expect((await request('DELETE', `/${empty.id}`, manager)).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityType: 'FACILITY', action: 'DELETE' } })).toBe(1);
    const names = (await readResult<Facility[]>(await request('GET', '/', manager))).map(({ name }) => name);
    expect(names).toEqual(['Sân 1']);
  });
});
