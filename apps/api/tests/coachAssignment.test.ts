import type { ClassDetail, ClassSummary, CoachRegistration, Paginated } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';
import { seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/classes'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const seedDraftClass = async (dates?: Parameters<typeof seedOpenClass>[0]) => {
  const { id, courseId } = await seedOpenClass(dates);
  const { sportId } = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  await prisma.class.update({ where: { id }, data: { status: 'DRAFT', coachId: null } });
  return { id, sportId };
};

const qualifiedCoach = async (email: string, sportId: string) => {
  const coach = await createAccount('COACH', email);
  await prisma.coachSpecialization.create({ data: { coachId: coach.id, sportId, status: 'APPROVED' } });
  return coach;
};

const coachOf = async (classId: string): Promise<Viewer> => {
  const { coachId } = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  return { id: coachId!, role: 'COACH' };
};

describe('coach assignment', () => {
  test('qualified coaches register for a draft class and the manager picks one of them', async () => {
    const cls = await seedDraftClass();
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const first = await qualifiedCoach('first@example.com', cls.sportId);
    const second = await qualifiedCoach('second@example.com', cls.sportId);
    const outsider = await createAccount('COACH', 'outsider@example.com');
    const needsCoach = async (coach: Viewer) =>
      (await readResult<Paginated<ClassSummary>>(await request('GET', '/?needsCoach=true', coach))).items.map(
        ({ id }) => id,
      );
    expect(await needsCoach(first)).toEqual([cls.id]);
    expect(await needsCoach(outsider)).toEqual([]);

    const denied = await request('POST', `/${cls.id}/coach-registrations`, outsider);
    expect([denied.status, await readCode(denied)]).toEqual([403, 'FORBIDDEN']);

    const register = (coach: Viewer) => request('POST', `/${cls.id}/coach-registrations`, coach);
    const chosen = await register(first);
    expect(chosen.status).toBe(201);
    expect((await register(first)).status).toBe(409);
    const other = await readResult<CoachRegistration>(await register(second));
    expect(await prisma.class.findUnique({ where: { id: cls.id } })).toMatchObject({ status: 'PENDING_APPROVAL' });

    const assign = (body: unknown) => request('POST', `/${cls.id}/assign-coach`, manager, body);
    const response = await assign({ registrationId: (await readResult<CoachRegistration>(chosen)).id });
    expect(response.status).toBe(200);
    expect(await readResult<ClassDetail>(response)).toMatchObject({ coach: { id: first.id } });
    const registrations = await readResult<CoachRegistration[]>(
      await request('GET', `/${cls.id}/coach-registrations`, manager),
    );
    expect(registrations.map(({ coach, status }) => [coach.id, status])).toEqual([
      [first.id, 'APPROVED'],
      [second.id, 'REJECTED'],
    ]);
    expect((await assign({ registrationId: other.id })).status).toBe(409);

    const cancelled = await seedDraftClass({
      startDate: addDays(todayInCenter(), 4),
      endDate: addDays(todayInCenter(), 11),
    });
    await prisma.coachSpecialization.create({
      data: { coachId: first.id, sportId: cancelled.sportId, status: 'APPROVED' },
    });
    expect((await request('POST', `/${cancelled.id}/coach-registrations`, first)).status).toBe(201);
    expect((await request('POST', `/${cancelled.id}/cancel`, manager, { reason: 'Đóng lớp' })).status).toBe(200);
    expect(await prisma.classCoachRegistration.findFirst({ where: { classId: cancelled.id } })).toMatchObject({
      status: 'REJECTED',
    });
  });

  test('assigning a coach who already teaches at that time changes nothing', async () => {
    const busy = await seedOpenClass();
    const target = await seedDraftClass();
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const coach = await coachOf(busy.id);
    await prisma.coachSpecialization.create({
      data: { coachId: coach.id, sportId: target.sportId, status: 'APPROVED' },
    });

    const response = await request('POST', `/${target.id}/assign-coach`, manager, { coachId: coach.id });
    expect([response.status, await readCode(response)]).toEqual([409, 'SCHEDULE_CONFLICT']);
    expect(await prisma.class.findUnique({ where: { id: target.id } })).toMatchObject({ coachId: null });
    expect(await prisma.classCoachRegistration.count()).toBe(0);
  });

  test('a coach leaving before the start keeps the students enrolled and tells them; a started class refuses', async () => {
    const cls = await seedOpenClass();
    const coach = await coachOf(cls.id);
    const member = await createAccount('MEMBER', 'member@example.com');
    await seedBalance(member.id, 300_000);
    const bought = await checkout('POST', '/', member, {
      items: [{ type: 'COURSE_ENROLLMENT', classId: cls.id }],
      paymentMethod: 'WALLET',
      expectedTotal: 300_000,
      idempotencyKey: `buy-${crypto.randomUUID()}`,
    });
    expect(bought.status).toBe(201);

    const response = await request('POST', `/${cls.id}/withdraw`, coach);
    expect(response.status).toBe(200);
    expect(await readResult<ClassDetail>(response)).toMatchObject({ status: 'PENDING_APPROVAL', coach: null });
    expect(await prisma.classEnrollment.count({ where: { classId: cls.id, status: 'ENROLLED' } })).toBe(1);
    expect(await prisma.notification.count({ where: { accountId: member.id, referenceId: cls.id } })).toBe(1);

    const started = await seedOpenClass({ startDate: todayInCenter() });
    const denied = await request('POST', `/${started.id}/withdraw`, await coachOf(started.id));
    expect([denied.status, await readCode(denied)]).toEqual([409, 'INVALID_STATE']);
  });
});
