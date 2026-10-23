import type { RosterEntry, StudentProgress } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { setupAttendance } from './helpers/attendance';
import { resetDatabase } from './helpers/db';
import { readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer('/classes'));
});
afterAll(() => server.close());
beforeEach(resetDatabase);

describe('class roster', () => {
  test('the class coach sees each student with goals, attendance and latest result; others are refused', async () => {
    const f = await setupAttendance();
    await prisma.memberProfile.update({
      where: { accountId: f.member.id },
      data: { fitnessGoals: 'Bơi 50m liên tục', healthNotes: 'Hen suyễn nhẹ' },
    });
    await prisma.classAttendance.create({
      data: { sessionId: f.session.id, accountId: f.member.id, status: 'LATE', note: 'Kẹt xe' },
    });
    await prisma.memberEvaluation.create({
      data: { sessionId: f.session.id, accountId: f.member.id, coachId: f.coach.id, rating: 4 },
    });

    const roster = await readResult<RosterEntry[]>(await request('GET', `/${f.cls.id}/roster`, f.coach));
    const member = roster.find(({ account }) => account.id === f.member.id)!;
    expect(member).toMatchObject({
      fitnessGoals: 'Bơi 50m liên tục',
      healthNotes: 'Hen suyễn nhẹ',
      attendance: { present: 0, late: 1, absent: 0, unmarked: 0 },
      lastResult: { sessionNumber: 1, rating: 4 },
      planUpdatedAt: null,
      reviews: [],
    });
    expect(roster.find(({ account }) => account.id === f.second.id)?.attendance.unmarked).toBe(1);

    expect((await request('GET', `/${f.cls.id}/roster`, f.otherCoach)).status).toBe(403);
    expect((await request('GET', `/${f.cls.id}/roster`, f.manager)).status).toBe(200);

    const detail = await readResult<StudentProgress>(
      await request('GET', `/${f.cls.id}/students/${f.member.id}`, f.coach),
    );
    expect(detail.attendance.map(({ status, note }) => [status, note])).toEqual([['LATE', 'Kẹt xe']]);
    expect(detail.results.map(({ rating }) => rating)).toEqual([4]);
    expect((await request('GET', `/${f.cls.id}/students/${f.outsider.id}`, f.coach)).status).toBe(404);
  });
});
