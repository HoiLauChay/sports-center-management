import type { Attendance, MyAttendance } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import { CRON } from '~/constants/cron';
import attendanceJobService from '~/services/attendanceJob.service';
import auditService from '~/services/audit.service';
import { addDays } from '~/utils/time';
import { setupAttendance } from './helpers/attendance';
import { resetDatabase } from './helpers/db';
import { readCode, readResult, startServer } from './helpers/http';

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

describe('attendance #175', () => {
  test('enrollment timestamps retain their UTC instants in the database', async () => {
    const f = await setupAttendance();
    const cancelledAt = new Date(f.end.getTime() + 1);
    await prisma.classEnrollment.update({
      where: { id: f.enrollment.id },
      data: { status: 'CANCELLED', cancelledAt },
    });
    // Compare physical timestamptz instants; a driver round-trip alone can hide timezone shifts.
    const [stored] = await prisma.$queryRaw<{ enrolledAtMs: number; cancelledAtMs: number }[]>`
      SELECT (extract(epoch FROM enrolled_at) * 1000)::double precision AS "enrolledAtMs",
             (extract(epoch FROM cancelled_at) * 1000)::double precision AS "cancelledAtMs"
      FROM class_enrollments WHERE id = ${f.enrollment.id}::uuid
    `;
    expect(stored).toEqual({
      enrolledAtMs: f.start.getTime() - 86_400_000,
      cancelledAtMs: cancelledAt.getTime(),
    });
  });

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

  test('create, update and note-only edits preserve one record, updater and per-record audits; repeat is a no-op', async () => {
    const f = await setupAttendance();
    const path = `/sessions/${f.session.id}/attendance`;
    const save = (status: string, note?: string, viewer = f.coach) =>
      request('PUT', path, viewer, {
        records: [{ accountId: f.member.id, status, ...(note !== undefined && { note }) }],
      });
    expect((await save('PRESENT', 'Có ghi chú riêng')).status).toBe(200);
    expect((await save('LATE', undefined, f.manager)).status).toBe(200);
    let row = await prisma.classAttendance.findFirstOrThrow();
    expect(row).toMatchObject({ status: 'LATE', note: 'Có ghi chú riêng', updatedById: f.manager.id });
    const updatedAt = row.updatedAt.toISOString();
    expect((await save('LATE', undefined, f.manager)).status).toBe(200);
    expect((await prisma.classAttendance.findFirstOrThrow()).updatedAt.toISOString()).toBe(updatedAt);
    expect((await save('LATE', 'Ghi chú sức khỏe nhạy cảm')).status).toBe(200);
    expect((await save('LATE', '')).status).toBe(200);
    row = await prisma.classAttendance.findFirstOrThrow();
    expect(row.note).toBeNull();
    expect(await prisma.classAttendance.count()).toBe(1);
    const audits = await prisma.auditLog.findMany({
      where: { entityType: 'CLASS_ATTENDANCE' },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((a) => a.action)).toEqual(['CREATE', 'UPDATE', 'UPDATE', 'UPDATE']);
    expect(JSON.stringify(audits)).not.toContain('nhạy cảm');
    expect(audits[2]!.newValues).toMatchObject({ noteChanged: true });
    const mine = await readResult<MyAttendance[]>(await request('GET', `/me/attendance?classId=${f.cls.id}`, f.member));
    expect(mine[0]).toMatchObject({ session: { id: f.session.id }, status: 'LATE', note: null });
    expect(
      await readResult<MyAttendance[]>(await request('GET', `/me/attendance?classId=${f.cls.id}`, f.outsider)),
    ).toEqual([]);
    expect((await request('GET', '/me/attendance', f.coach)).status).toBe(403);
  });

  test('invalid member in a batch rejects all records; payload and note boundaries are validated', async () => {
    const f = await setupAttendance();
    const path = `/sessions/${f.session.id}/attendance`;
    const valid = { accountId: f.member.id, status: 'PRESENT' };
    const save = (records: unknown) => request('PUT', path, f.manager, { records });
    expect((await save([valid, { accountId: f.outsider.id, status: 'ABSENT' }])).status).toBe(422);
    expect(await prisma.classAttendance.count()).toBe(0);
    for (const records of [
      [],
      [valid, valid],
      [{ ...valid, status: 'UNKNOWN' }],
      [{ ...valid, note: 'x'.repeat(501) }],
      [{ ...valid, accountId: 'invalid' }],
    ]) {
      expect((await save(records)).status).toBe(422);
    }
    expect(
      (
        await save([
          { ...valid, note: 'x'.repeat(500) },
          { accountId: f.second.id, status: 'ABSENT' },
        ])
      ).status,
    ).toBe(200);
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS_ATTENDANCE' } })).toBe(2);
    expect((await request('GET', '/me/attendance?classId=invalid', f.member)).status).toBe(422);
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

  test('cancelled sessions cannot be marked and never receive defaults', async () => {
    const f = await setupAttendance();
    await prisma.classSession.update({ where: { id: f.session.id }, data: { status: 'CANCELLED' } });
    const response = await request('PUT', `/sessions/${f.session.id}/attendance`, f.manager, {
      records: [{ accountId: f.member.id, status: 'PRESENT' }],
    });
    expect([response.status, await readCode(response)]).toEqual([409, 'INVALID_STATE']);
    expect(await attendanceJobService.run(f.end)).toEqual({ processed: 0, remaining: 0 });
  });

  test('past uncancelled sessions retain member history after the class is cancelled and archived', async () => {
    const f = await setupAttendance();
    await prisma.class.update({ where: { id: f.cls.id }, data: { status: 'CANCELLED', deletedAt: new Date() } });
    await prisma.classEnrollment.updateMany({
      data: { status: 'CANCELLED', cancelledAt: new Date(f.end.getTime() + 1) },
    });
    expect(await attendanceJobService.run(f.end)).toEqual({ processed: 2, remaining: 0 });
    const history = await readResult<MyAttendance[]>(await request('GET', '/me/attendance', f.member));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ session: { id: f.session.id }, status: 'ABSENT' });
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

  test('manual writes racing defaults keep the coach result and the unique record', async () => {
    const f = await setupAttendance();
    const [response] = await Promise.all([
      request('PUT', `/sessions/${f.session.id}/attendance`, f.coach, {
        records: [{ accountId: f.member.id, status: 'PRESENT', note: 'Coach xác nhận' }],
      }),
      attendanceJobService.run(f.end),
    ]);
    expect(response.status).toBe(200);
    expect(await prisma.classAttendance.count({ where: { sessionId: f.session.id, accountId: f.member.id } })).toBe(1);
    expect(await prisma.classAttendance.findFirst({ where: { accountId: f.member.id } })).toMatchObject({
      status: 'PRESENT',
      note: 'Coach xác nhận',
    });
  });

  test('audit failure rolls back both a manual batch and default job', async () => {
    const f = await setupAttendance();
    const original = auditService.record;
    const record = spyOn(auditService, 'record')
      .mockImplementationOnce((...args) => original(...args))
      .mockRejectedValue(new Error('audit failure'));
    const errors = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request('PUT', `/sessions/${f.session.id}/attendance`, f.manager, {
        records: [
          { accountId: f.member.id, status: 'PRESENT' },
          { accountId: f.second.id, status: 'LATE' },
        ],
      });
      expect(response.status).toBe(500);
      expect(await prisma.classAttendance.count()).toBe(0);
      expect(await prisma.auditLog.count()).toBe(0);
      await expect(attendanceJobService.run(f.end)).rejects.toThrow('audit failure');
      expect(await prisma.classAttendance.count()).toBe(0);
    } finally {
      record.mockRestore();
      errors.mockRestore();
    }
  });

  test('cron requires its secret, bypasses Origin and reports remaining work', async () => {
    await setupAttendance();
    const run = (secret?: string) =>
      fetch(`${baseUrl}/cron/attendance-defaults`, {
        method: 'POST',
        headers: { Origin: 'https://unrelated.example', ...(secret && { Authorization: `Bearer ${secret}` }) },
      });
    expect((await run()).status).toBe(401);
    expect((await run('wrong-secret')).status).toBe(401);
    expect(await readResult<{ processed: number; remaining: number }>(await run(env.CRON_SECRET))).toEqual({
      processed: 2,
      remaining: 0,
    });
    expect(await readResult<{ processed: number; remaining: number }>(await run(env.CRON_SECRET))).toEqual({
      processed: 0,
      remaining: 0,
    });
  });

  test('defaults process at most one configured batch and count the remaining missing member/session pairs', async () => {
    const f = await setupAttendance();
    const extraSessions = Math.floor(CRON.BATCH_SIZE / 2);
    await prisma.classEnrollment.updateMany({
      data: { enrolledAt: new Date(addDays(f.date, -extraSessions - 1)) },
    });
    await prisma.classSession.createMany({
      data: Array.from({ length: extraSessions }, (_, index) => ({
        classId: f.cls.id,
        facilityId: f.session.facilityId,
        sessionNumber: index + 2,
        sessionDate: new Date(addDays(f.date, -index - 1)),
        startTime: f.session.startTime,
        endTime: f.session.endTime,
      })),
    });
    expect(await attendanceJobService.run(f.end)).toEqual({ processed: CRON.BATCH_SIZE, remaining: 2 });
    expect(await attendanceJobService.run(f.end)).toEqual({ processed: 2, remaining: 0 });
    expect(await prisma.classAttendance.count()).toBe(CRON.BATCH_SIZE + 2);
    expect(await prisma.auditLog.count({ where: { entityType: 'CLASS_ATTENDANCE' } })).toBe(CRON.BATCH_SIZE + 2);
  }, 30_000);
});
