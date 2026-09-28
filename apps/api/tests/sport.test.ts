import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import type { buildFetcher } from './helpers/http';
import { createAccount, readCode, readResult, startServer } from './helpers/http';

let server: Server;
let req: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request: req } = await startServer('/sports'));
});

afterAll(() => server.close());
beforeEach(resetDatabase);
afterEach(() => mock.restore());

interface SportResult {
  id: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  isActive: boolean;
}

describe('sport crud', () => {
  test('manager creates, updates and lists sports; member only sees active ones', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');

    const res = await req('POST', '/', manager, { name: 'Cầu lông', description: 'Bộ môn cầu lông' });
    expect(res.status).toBe(201);
    const sport = await readResult<SportResult>(res);
    expect(sport).toMatchObject({ name: 'Cầu lông', description: 'Bộ môn cầu lông', isActive: true });

    const updateRes = await req('PATCH', `/${sport.id}`, manager, { name: 'Badminton', isActive: false });
    expect(updateRes.status).toBe(200);
    expect(await readResult<SportResult>(updateRes)).toMatchObject({ name: 'Badminton', isActive: false });

    const managerList = await readResult<SportResult[]>(await req('GET', '/', manager));
    expect(managerList).toHaveLength(1);

    const memberList = await readResult<SportResult[]>(await req('GET', '/', member));
    expect(memberList).toHaveLength(0);

    await req('DELETE', `/${sport.id}`, manager);
    expect(await readResult<SportResult[]>(await req('GET', '/', manager))).toHaveLength(0);

    expect(await prisma.auditLog.count({ where: { entityType: 'SPORT' } })).toBe(3);
  });

  test('duplicate sport name returns 409 with NAME_TAKEN', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await req('POST', '/', manager, { name: 'Yoga' });
    const dup = await req('POST', '/', manager, { name: 'Yoga' });
    expect(dup.status).toBe(409);
    expect(await readCode(dup)).toBe('NAME_TAKEN');

    const differentCase = await req('POST', '/', manager, { name: 'yOGA' });
    expect(differentCase.status).toBe(409);
    expect(await readResult<SportResult[]>(await req('GET', '/', manager))).toMatchObject([{ name: 'Yoga' }]);
  });

  test('icon must be a file uploaded through the system', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const res = await req('POST', '/', manager, { name: 'Boxing', iconUrl: 'https://example.com/icon.png' });
    expect(res.status).toBe(422);
    expect(await prisma.sport.count()).toBe(0);
  });

  test('cannot delete or deactivate sport with unfinished classes', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');

    const sport = await prisma.sport.create({ data: { name: 'Futsal' } });
    const course = await prisma.course.create({
      data: { name: 'Futsal cơ bản', sportId: sport.id, totalSessions: 10, price: 500000 },
    });
    const facility = await prisma.facility.create({
      data: { name: 'Sân 1', type: 'FIELD', capacityPerSlot: 20, pricePerSlot: 100000 },
    });
    await prisma.class.create({
      data: {
        courseId: course.id,
        facilityId: facility.id,
        name: 'Futsal A',
        maxStudents: 20,
        weeklySchedule: [],
        status: 'DRAFT',
      },
    });

    const deleteRes = await req('DELETE', `/${sport.id}`, manager);
    expect(deleteRes.status).toBe(409);
    expect(await readCode(deleteRes)).toBe('HAS_DEPENDENCIES');

    const deactivateRes = await req('PATCH', `/${sport.id}`, manager, { isActive: false });
    expect(deactivateRes.status).toBe(409);
    expect(await readCode(deactivateRes)).toBe('HAS_DEPENDENCIES');
  });
});
