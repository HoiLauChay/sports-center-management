import type { Attendance, CoachScheduleItem, MyAttendance } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import attendanceJobService from '~/services/attendanceJob.service';
import { addDays, todayInCenter } from '~/utils/time';
import { setupAttendance } from './helpers/attendance';
import { resetDatabase } from './helpers/db';
import { readResult, startServer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let baseUrl: string;
beforeAll(async () => {
  ({ server, request } = await startServer(''));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  baseUrl = `http://localhost:${address.port}/api/v1`;
});
afterAll(() => server.close());
beforeEach(resetDatabase);

describe('attendance window', () => {
  test('a coach marks from 15 minutes before the start until 7 days after; the manager is not limited', async () => {
    const f = await setupAttendance();
    const record = { records: [{ accountId: f.member.id, status: 'PRESENT' }] };
    const put = (sessionId: string, who = f.coach) => request('PUT', `/sessions/${sessionId}/attendance`, who, record);

    expect((await put(f.session.id)).status).toBe(200);
    const schedule = await readResult<CoachScheduleItem[]>(
      await request('GET', `/coach/schedule?from=${f.date}&to=${f.date}`, f.coach),
    );
    expect(schedule.find(({ id }) => id === f.session.id)).toMatchObject({
      attendance: { marked: 1, total: 2 },
      hasNote: false,
    });

    const tomorrow = await f.makeSession({ sessionDate: new Date(addDays(todayInCenter(), 1)) });
    expect((await put(tomorrow.id)).status).toBe(409);

    await prisma.classEnrollment.update({
      where: { id: f.enrollment.id },
      data: { enrolledAt: new Date(addDays(todayInCenter(), -30)) },
    });
    const old = await f.makeSession({ sessionDate: new Date(addDays(todayInCenter(), -8)) });
    expect((await put(old.id)).status).toBe(409);
    expect((await put(old.id, f.manager)).status).toBe(200);
  });
});

describe('attendance #175', () => {
  test('assigned coach sees the roster including unmarked members; another coach gets 403 for both reads and writes', async () => {
    const f = await setupAttendance();
    const path = `/sessions/${f.session.id}/attendance`;
    const rows = await readResult<Attendance[]>(await request('GET', path, f.coach));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.status === null && r.updatedAt === null && r.updatedBy === null)).toBe(true);
    expect((await request('GET', path, f.otherCoach)).status).toBe(403);
    expect(
      (await request('PUT', path, f.otherCoach, { records: [{ accountId: f.member.id, status: 'PRESENT' }] })).status,
    ).toBe(403);
    expect(await prisma.classAttendance.count()).toBe(0);
    expect(await prisma.auditLog.count()).toBe(0);
    expect((await request('GET', path, f.manager)).status).toBe(200);
    expect((await request('GET', path, f.receptionist)).status).toBe(403);
    expect((await request('GET', path, f.member)).status).toBe(403);
    expect((await fetch(baseUrl + path)).status).toBe(401);
    expect((await request('GET', `/sessions/${randomUUID()}/attendance`, f.manager)).status).toBe(404);
  });

  test('historical enrollment includes cancellation after the session and excludes before/start or enrollment afterwards', async () => {
    const f = await setupAttendance();
    await prisma.classEnrollment.update({
      where: { id: f.enrollment.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(f.end.getTime() + 1) },
    });
    await f.enroll(f.member.id, { enrolledAt: new Date(f.end.getTime() + 2) });
    await prisma.classEnrollment.updateMany({
      where: { accountId: f.second.id },
      data: { status: 'CANCELLED', cancelledAt: f.start },
    });
    await f.enroll(f.outsider.id, { enrolledAt: new Date(f.start.getTime() + 1) });
    const rows = await readResult<Attendance[]>(
      await request('GET', `/sessions/${f.session.id}/attendance`, f.manager),
    );
    expect(rows.map((r) => r.account.id)).toEqual([f.member.id]);
    const history = await readResult<MyAttendance[]>(await request('GET', '/me/attendance', f.member));
    expect(history.map((r) => r.session.id)).toEqual([f.session.id]);
    expect(await attendanceJobService.run(f.end)).toEqual({ processed: 1, remaining: 0 });
    expect((await prisma.classAttendance.findFirstOrThrow()).accountId).toBe(f.member.id);
  });

  test('defaults start exactly at end in center time, preserve existing data and are idempotent under concurrency', async () => {
    const f = await setupAttendance();
    await f.makeSession({ sessionDate: new Date(addDays(f.date, 2)) });
    await request('PUT', `/sessions/${f.session.id}/attendance`, f.coach, {
      records: [{ accountId: f.member.id, status: 'LATE', note: 'Giữ nguyên' }],
    });
    expect(await attendanceJobService.run(new Date(f.end.getTime() - 1))).toEqual({ processed: 0, remaining: 0 });
    const results = await Promise.all([attendanceJobService.run(f.end), attendanceJobService.run(f.end)]);
    expect(results.map((r) => r.processed).sort()).toEqual([0, 1]);
    expect(await prisma.classAttendance.count()).toBe(2);
    expect(await prisma.classAttendance.findFirst({ where: { accountId: f.member.id } })).toMatchObject({
      status: 'LATE',
      note: 'Giữ nguyên',
      updatedById: f.coach.id,
    });
    expect(await prisma.classAttendance.findFirst({ where: { accountId: f.second.id } })).toMatchObject({
      status: 'ABSENT',
      updatedById: null,
    });
  });
});
