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

    const managerList = await readResult<SpecResult[]>(await mgrReq('GET', '/', manager));
    expect(managerList).toHaveLength(1);

    const reviewRes = await mgrReq('POST', `/${spec.id}/approve`, manager, {});
    expect(reviewRes.status).toBe(200);
    expect(await readResult<SpecResult>(reviewRes)).toMatchObject({ status: 'APPROVED' });

    const notifications = await prisma.notification.findMany({ where: { accountId: coach.id } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.title).toContain('được duyệt');

    expect(await prisma.auditLog.count({ where: { entityType: 'COACH_SPECIALIZATION' } })).toBe(2);
  });

  test('duplicate PENDING/APPROVED registration returns 409', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await createSport('Tennis');

    await coachReq('POST', '/', coach, { sportId: sport.id });
    const dup = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(dup.status).toBe(409);
    expect(await readCode(dup)).toBe('DUPLICATE_REQUEST');
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
  });

  test('register for inactive sport returns 422', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await createSport('Bóng rổ', false);

    const res = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(res.status).toBe(422);
  });

  test('register for deleted sport returns 422', async () => {
    const coach = await createAccount('COACH', 'coach@example.com');
    const sport = await prisma.sport.create({ data: { name: 'Deleted Sport', deletedAt: new Date() } });

    const res = await coachReq('POST', '/', coach, { sportId: sport.id });
    expect(res.status).toBe(422);
  });
});
