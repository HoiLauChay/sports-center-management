import type { ClassSummary, CoachRegistration } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());

beforeEach(resetDatabase);

const coachOf = async (classId: string): Promise<Viewer> => {
  const { coachId } = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  return { id: coachId!, role: 'COACH' };
};

const dates = (offset: number) => ({
  startDate: addDays(todayInCenter(), offset),
  endDate: addDays(todayInCenter(), offset + 7),
});

describe('coach views', () => {
  test('a coach lists the classes assigned to them, earliest first, without cancelled ones', async () => {
    const later = await seedOpenClass(dates(5));
    const coach = await coachOf(later.id);
    const earlier = await seedOpenClass(dates(2));
    const cancelled = await seedOpenClass(dates(3));
    await prisma.class.updateMany({ where: { id: { in: [earlier.id, cancelled.id] } }, data: { coachId: coach.id } });
    await prisma.class.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    const other = await seedOpenClass();

    const mine = await readResult<ClassSummary[]>(await request('GET', '/coach/classes', coach));
    expect(mine.map(({ id }) => id)).toEqual([earlier.id, later.id]);
    const theirs = await readResult<ClassSummary[]>(await request('GET', '/coach/classes', await coachOf(other.id)));
    expect(theirs.map(({ id }) => id)).toEqual([other.id]);
    const member = await createAccount('MEMBER', 'member@example.com');
    expect((await request('GET', '/coach/classes', member)).status).toBe(403);
  });

  test('a coach lists only their own teaching registrations, filtered by status', async () => {
    const cls = await seedOpenClass();
    await prisma.class.update({ where: { id: cls.id }, data: { status: 'DRAFT', coachId: null } });
    const [coach, other] = await Promise.all(
      ['coach@example.com', 'other@example.com'].map((email) => createAccount('COACH', email)),
    );
    const pending = await prisma.classCoachRegistration.create({
      data: { classId: cls.id, coachId: coach!.id, source: 'COACH_REGISTERED' },
    });
    const rejected = await prisma.classCoachRegistration.create({
      data: { classId: cls.id, coachId: coach!.id, source: 'COACH_REGISTERED', status: 'REJECTED' },
    });
    await prisma.classCoachRegistration.create({
      data: { classId: cls.id, coachId: other!.id, source: 'COACH_REGISTERED' },
    });

    const list = async (query = '') =>
      (await readResult<CoachRegistration[]>(await request('GET', `/coach/registrations${query}`, coach!))).map(
        ({ id }) => id,
      );
    expect((await list()).sort()).toEqual([pending.id, rejected.id].sort());
    expect(await list('?status=PENDING')).toEqual([pending.id]);
    expect((await request('GET', '/coach/registrations?status=BAD', coach!)).status).toBe(422);
  });
});
