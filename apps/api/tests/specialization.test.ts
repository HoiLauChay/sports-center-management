import type { Specialization } from '@sports-center/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());
beforeEach(resetDatabase);
afterEach(() => mock.restore());

interface SpecPage {
  items: Specialization[];
  total: number;
  page: number;
  limit: number;
}

const createSport = (name: string, isActive = true) => prisma.sport.create({ data: { name, isActive } });

const register = (coach: Viewer, sportId: string) => request('POST', '/coach/specializations', coach, { sportId });

const registered = async (coach: Viewer, sportId: string) => readResult<Specialization>(await register(coach, sportId));

const review = (manager: Viewer, id: string, decision: 'approve' | 'reject', body: unknown = {}) =>
  request('POST', `/specializations/${id}/${decision}`, manager, body);

describe('register and review specialization', () => {
  test('coach registers, manager approves once with audit and notification', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Bóng đá');

    const res = await register(coach, sport.id);
    expect(res.status).toBe(201);
    const spec = await readResult<Specialization>(res);
    expect(spec).toMatchObject({ coach: { id: coach.id }, sport: { name: 'Bóng đá' }, status: 'PENDING' });

    const coachList = await readResult<Specialization[]>(await request('GET', '/coach/specializations', coach));
    expect(coachList.map(({ id }) => id)).toEqual([spec.id]);

    const approved = await review(manager, spec.id, 'approve', { reviewNote: '  ' });
    expect(approved.status).toBe(200);
    expect(await readResult<Specialization>(approved)).toMatchObject({ status: 'APPROVED', reviewNote: null });

    const again = await review(manager, spec.id, 'reject');
    expect(again.status).toBe(409);
    expect(await readCode(again)).toBe('CONFLICT');

    const notifications = await prisma.notification.findMany({ where: { accountId: coach.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.title).toContain('được duyệt');
    expect(notifications[0]!.sendEmail).toBe(false);
    expect(await prisma.auditLog.count({ where: { entityId: spec.id, action: 'APPROVE' } })).toBe(1);
  });

  test('duplicate PENDING and APPROVED registrations return 409 CONFLICT', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Tennis');

    const first = await registered(coach, sport.id);
    const pendingDuplicate = await register(coach, sport.id);
    expect(pendingDuplicate.status).toBe(409);
    expect(await readCode(pendingDuplicate)).toBe('CONFLICT');

    expect((await review(manager, first.id, 'approve')).status).toBe(200);
    const approvedDuplicate = await register(coach, sport.id);
    expect(approvedDuplicate.status).toBe(409);
    expect(await readCode(approvedDuplicate)).toBe('CONFLICT');
  });

  test('rejected then re-register succeeds, old record preserved', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Yoga');

    const first = await registered(coach, sport.id);
    const rejected = await review(manager, first.id, 'reject', { reviewNote: 'Thiếu chứng chỉ' });
    expect(await readResult<Specialization>(rejected)).toMatchObject({
      status: 'REJECTED',
      reviewNote: 'Thiếu chứng chỉ',
    });
    expect(await prisma.auditLog.count({ where: { entityId: first.id, action: 'REJECT' } })).toBe(1);

    const second = await registered(coach, sport.id);
    expect(second.status).toBe('PENDING');
    expect(second.id).not.toBe(first.id);

    const all = await prisma.coachSpecialization.findMany({ where: { coachId: coach.id, sportId: sport.id } });
    expect(all.map(({ status }) => status).sort()).toEqual(['PENDING', 'REJECTED']);
  });

  test('inactive or deleted sport returns 422 on sportId', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const inactive = await createSport('Bóng rổ', false);
    const deleted = await prisma.sport.create({ data: { name: 'Bóng chuyền', deletedAt: new Date() } });

    for (const sport of [inactive, deleted]) {
      const res = await register(coach, sport.id);
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string; errors?: { path: string }[] };
      expect(body.code).toBe('VALIDATION_ERROR');
      expect(body.errors?.map(({ path }) => path)).toContain('body.sportId');
    }
  });

  test('pending registration cannot be approved after its sport is deactivated but can be rejected', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Bơi lội');
    const spec = await registered(coach, sport.id);
    await prisma.sport.update({ where: { id: sport.id }, data: { isActive: false } });

    const approved = await review(manager, spec.id, 'approve');
    expect(approved.status).toBe(409);
    expect(await readCode(approved)).toBe('CONFLICT');

    expect((await review(manager, spec.id, 'reject')).status).toBe(200);
  });

  test('manager paginates and combines status, coach and sport filters', async () => {
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const firstCoach = await createAccount('COACH', 'first@example.com');
    const secondCoach = await createAccount('COACH', 'second@example.com');
    const tennis = await createSport('Tennis');
    const yoga = await createSport('Yoga');

    const first = await registered(firstCoach, tennis.id);
    await registered(firstCoach, yoga.id);
    await registered(secondCoach, tennis.id);
    const fourth = await registered(secondCoach, yoga.id);
    await review(manager, first.id, 'approve');

    const getPage = async (query: string) => {
      const response = await request('GET', `/specializations?${query}`, manager);
      expect(response.status).toBe(200);
      return readResult<SpecPage>(response);
    };

    const page = await getPage('page=2&limit=3');
    expect(page).toMatchObject({ total: 4, page: 2, limit: 3 });
    expect(page.items).toHaveLength(1);

    const combined = await getPage(`status=PENDING&coachId=${secondCoach.id}&sportId=${yoga.id}`);
    expect(combined).toMatchObject({ total: 1, items: [{ id: fourth.id }] });
  });
});

describe('concurrent specialization requests', () => {
  test('concurrent registrations create one specialization and return one 409 CONFLICT', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await createSport('Tennis');

    const responses = await Promise.all([register(coach, sport.id), register(coach, sport.id)]);
    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(await readCode(responses.find(({ status }) => status === 409)!)).toBe('CONFLICT');
    expect(await prisma.coachSpecialization.count({ where: { coachId: coach.id, sportId: sport.id } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: 'COACH_SPECIALIZATION', action: 'CREATE' } })).toBe(1);
  });

  test('concurrent manager decisions leave one review, audit entry and notification', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const firstManager = await createAccount('MANAGER', 'first-manager@example.com');
    const secondManager = await createAccount('MANAGER', 'second-manager@example.com');
    const sport = await createSport('Tennis');
    const spec = await registered(coach, sport.id);

    const responses = await Promise.all([
      review(firstManager, spec.id, 'approve', { reviewNote: 'Approved' }),
      review(secondManager, spec.id, 'reject', { reviewNote: 'Rejected' }),
    ]);
    expect(responses.map(({ status }) => status).sort((a, b) => a - b)).toEqual([200, 409]);

    const decision = responses[0]!.status === 200 ? 'APPROVED' : 'REJECTED';
    const final = await prisma.coachSpecialization.findUniqueOrThrow({ where: { id: spec.id } });
    expect(final.status).toBe(decision);
    expect(await prisma.auditLog.count({ where: { entityId: spec.id, action: { in: ['APPROVE', 'REJECT'] } } })).toBe(
      1,
    );
    expect(await prisma.notification.count({ where: { accountId: coach.id } })).toBe(1);
  });
});
