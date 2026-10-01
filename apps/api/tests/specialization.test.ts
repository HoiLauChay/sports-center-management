import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import app from '~/app';
import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult } from './helpers/http';

let server: Server;
let coachReq: ReturnType<typeof buildFetcher>;
let mgrReq: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://localhost:${port}/api/v1`;
  coachReq = buildFetcher(`${base}/coach/specializations`);
  mgrReq = buildFetcher(`${base}/specializations`);
});

afterAll(() => server.close());
beforeEach(resetDatabase);
afterEach(() => mock.restore());

interface SpecResult {
  id: string;
  coach: { id: string; fullName: string };
  sport: { id: string; name: string };
  status: string;
  reviewNote: string | null;
}

interface SpecPage {
  items: SpecResult[];
  total: number;
  page: number;
  limit: number;
}

const createSport = (name: string, isActive = true) => prisma.sport.create({ data: { name, isActive } });

describe('specialization crud', () => {
  test('coach registers, manager approves; coach lists own', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Bóng đá');

    const res = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(res.status).toBe(201);
    const spec = await readResult<SpecResult>(res);
    expect(spec).toMatchObject({ sport: { name: 'Bóng đá' }, status: 'PENDING' });
    expect(spec.coach).toMatchObject({ id: coach.id });

    const coachList = await readResult<SpecResult[]>(await coachReq('GET', '/', coach));
    expect(coachList).toHaveLength(1);

    const managerList = await readResult<SpecPage>(await mgrReq('GET', '/', manager));
    expect(managerList).toMatchObject({ total: 1, page: 1 });
    expect(managerList.items).toHaveLength(1);

    const reviewRes = await mgrReq('POST', `/${spec.id}/approve`, manager, {});
    expect(reviewRes.status).toBe(200);
    expect(await readResult<SpecResult>(reviewRes)).toMatchObject({ status: 'APPROVED' });

    const notifications = await prisma.notification.findMany({ where: { accountId: coach.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.title).toContain('được duyệt');
    expect(notifications[0]!.sendEmail).toBe(false);

    expect(await prisma.auditLog.count({ where: { entityType: 'COACH_SPECIALIZATION' } })).toBe(2);
  });

  test('duplicate PENDING and APPROVED registrations return 409 CONFLICT', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Tennis');

    const first = await readResult<SpecResult>(await coachReq('POST', '/', coach, { sportId: sport.id }));
    const pendingDuplicate = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(pendingDuplicate.status).toBe(409);
    expect(await readCode(pendingDuplicate)).toBe('CONFLICT');

    expect((await mgrReq('POST', `/${first.id}/approve`, manager, {})).status).toBe(200);
    const approvedDuplicate = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(approvedDuplicate.status).toBe(409);
    expect(await readCode(approvedDuplicate)).toBe('CONFLICT');
  });

  test('manager filters by status, coach and sport, and paginates the filtered list', async () => {
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const firstCoach = await createAccount('COACH', 'first@example.com');
    const secondCoach = await createAccount('COACH', 'second@example.com');
    const tennis = await createSport('Tennis');
    const yoga = await createSport('Yoga');

    const first = await readResult<SpecResult>(await coachReq('POST', '/', firstCoach, { sportId: tennis.id }));
    const second = await readResult<SpecResult>(await coachReq('POST', '/', firstCoach, { sportId: yoga.id }));
    const third = await readResult<SpecResult>(await coachReq('POST', '/', secondCoach, { sportId: tennis.id }));
    const fourth = await readResult<SpecResult>(await coachReq('POST', '/', secondCoach, { sportId: yoga.id }));
    expect((await mgrReq('POST', `/${first.id}/approve`, manager, {})).status).toBe(200);

    const getPage = async (query: string) => {
      const response = await mgrReq('GET', `/?${query}`, manager);
      expect(response.status).toBe(200);
      return readResult<SpecPage>(response);
    };

    const firstPage = await getPage('page=1&limit=2');
    const secondPage = await getPage('page=2&limit=2');
    expect(firstPage).toMatchObject({ total: 4, page: 1, limit: 2 });
    expect(secondPage).toMatchObject({ total: 4, page: 2, limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(secondPage.items).toHaveLength(2);
    expect([...firstPage.items, ...secondPage.items].map(({ id }) => id).sort()).toEqual(
      [first.id, second.id, third.id, fourth.id].sort(),
    );

    const approved = await getPage('status=APPROVED');
    expect(approved).toMatchObject({ total: 1, items: [{ id: first.id, status: 'APPROVED' }] });

    const byCoach = await getPage(`coachId=${firstCoach.id}`);
    expect(byCoach.total).toBe(2);
    expect(byCoach.items.map(({ id }) => id).sort()).toEqual([first.id, second.id].sort());

    const bySport = await getPage(`sportId=${tennis.id}`);
    expect(bySport.total).toBe(2);
    expect(bySport.items.map(({ id }) => id).sort()).toEqual([first.id, third.id].sort());

    const combined = await getPage(`status=PENDING&coachId=${secondCoach.id}&sportId=${yoga.id}&page=1&limit=1`);
    expect(combined).toMatchObject({ total: 1, page: 1, limit: 1, items: [{ id: fourth.id }] });
  });

  test('concurrent registrations create one specialization and return one 409 CONFLICT', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await createSport('Tennis');

    const responses = await Promise.all([
      coachReq('POST', '/', coach, { sportId: sport.id }),
      coachReq('POST', '/', coach, { sportId: sport.id }),
    ]);
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
    const specialization = await readResult<SpecResult>(await coachReq('POST', '/', coach, { sportId: sport.id }));

    const responses = await Promise.all([
      mgrReq('POST', `/${specialization.id}/approve`, firstManager, { reviewNote: 'Approved' }),
      mgrReq('POST', `/${specialization.id}/reject`, secondManager, { reviewNote: 'Rejected' }),
    ]);
    expect(responses.filter(({ status }) => status === 200)).toHaveLength(1);
    expect(responses.filter(({ status }) => status >= 400 && status < 500)).toHaveLength(1);

    const successfulDecision = responses[0]!.status === 200 ? 'APPROVED' : 'REJECTED';
    const final = await prisma.coachSpecialization.findUniqueOrThrow({ where: { id: specialization.id } });
    expect(final.status).toBe(successfulDecision);
    expect(
      await prisma.auditLog.count({
        where: { entityType: 'COACH_SPECIALIZATION', entityId: specialization.id, action: 'UPDATE' },
      }),
    ).toBe(1);
    const notifications = await prisma.notification.findMany({ where: { accountId: coach.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.sendEmail).toBe(false);
  });

  test('rejected then re-register succeeds, old record preserved', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const manager = await createAccount('MANAGER', 'mgr@example.com');
    const sport = await createSport('Yoga');

    const first = await readResult<SpecResult>(await coachReq('POST', '/', coach, { sportId: sport.id }));
    await mgrReq('POST', `/${first.id}/reject`, manager, { reviewNote: 'Thiếu chứng chỉ' });

    const second = await readResult<SpecResult>(await coachReq('POST', '/', coach, { sportId: sport.id }));
    expect(second.status).toBe('PENDING');
    expect(second.id).not.toBe(first.id);

    const all = await prisma.coachSpecialization.findMany({ where: { coachId: coach.id, sportId: sport.id } });
    expect(all).toHaveLength(2);
    const notifications = await prisma.notification.findMany({ where: { accountId: coach.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.sendEmail).toBe(false);
  });

  test('register for inactive sport returns 422', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await createSport('Bóng rổ', false);

    const res = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; errors?: { path: string }[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors?.some(({ path }) => path === 'body.sportId')).toBe(true);
  });

  test('register for deleted sport returns 422', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Deleted Sport', deletedAt: new Date() } });

    const res = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string; errors?: { path: string }[] };
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.errors?.some(({ path }) => path === 'body.sportId')).toBe(true);
  });
});
