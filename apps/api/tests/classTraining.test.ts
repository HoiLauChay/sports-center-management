import type { ClassPlans, ProgressReview, RosterEntry, StudentProgress, TrainingPlan } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
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

describe('training plans', () => {
  test('only the class coach writes plans; the student is notified and the plan shows in the roster', async () => {
    const f = await setupAttendance();
    const body = { goals: 'Hoàn thiện kỹ thuật', content: 'Tuần 1: khởi động, tuần 2: bài nâng cao' };

    const classPlan = await readResult<TrainingPlan>(await request('PUT', `/${f.cls.id}/plan`, f.coach, body));
    expect(classPlan).toMatchObject({ account: null, goals: body.goals });
    await request('PUT', `/${f.cls.id}/plan`, f.coach, { ...body, goals: 'Mục tiêu mới' });
    expect(await prisma.trainingPlan.count({ where: { classId: f.cls.id, accountId: null } })).toBe(1);

    await readResult<TrainingPlan>(await request('PUT', `/${f.cls.id}/students/${f.member.id}/plan`, f.coach, body));
    expect(await prisma.notification.count({ where: { accountId: f.member.id, type: 'TRAINING' } })).toBe(1);
    expect((await request('PUT', `/${f.cls.id}/students/${f.outsider.id}/plan`, f.coach, body)).status).toBe(422);
    expect((await request('PUT', `/${f.cls.id}/plan`, f.otherCoach, body)).status).toBe(403);

    const plans = await readResult<ClassPlans>(await request('GET', `/${f.cls.id}/plans`, f.manager));
    expect(plans.classPlan?.goals).toBe('Mục tiêu mới');
    expect(plans.memberPlans.map(({ account }) => account?.id)).toEqual([f.member.id]);
    const roster = await readResult<RosterEntry[]>(await request('GET', `/${f.cls.id}/roster`, f.coach));
    expect(roster.find(({ account }) => account.id === f.member.id)?.planUpdatedAt).not.toBeNull();

    await prisma.class.update({ where: { id: f.cls.id }, data: { status: 'CANCELLED' } });
    expect((await request('PUT', `/${f.cls.id}/plan`, f.coach, body)).status).toBe(409);
  });
});

describe('progress reviews', () => {
  test('mid review opens at half the course, final after the last session; the first save notifies the student', async () => {
    const f = await setupAttendance();
    const later = await f.makeSession({ sessionDate: new Date(addDays(todayInCenter(), 3)) });
    await f.makeSession({ sessionDate: new Date(addDays(todayInCenter(), 4)) });
    const body = { technique: 4, fitness: 3, attitude: 5, comment: 'Tiến bộ rõ' };
    const path = (milestone: string) => `/${f.cls.id}/students/${f.member.id}/reviews/${milestone}`;

    expect((await request('PUT', path('MID'), f.coach, body)).status).toBe(409);
    await prisma.classSession.delete({ where: { id: later.id } });
    const mid = await readResult<ProgressReview>(await request('PUT', path('MID'), f.coach, body));
    expect(mid).toMatchObject({ milestone: 'MID', technique: 4, coach: { id: f.coach.id } });
    await readResult<ProgressReview>(await request('PUT', path('MID'), f.coach, { ...body, fitness: 4 }));
    expect(await prisma.notification.count({ where: { accountId: f.member.id, type: 'TRAINING' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityType: 'PROGRESS_REVIEW' } })).toBe(2);

    expect((await request('PUT', path('FINAL'), f.coach, body)).status).toBe(409);
    expect((await request('PUT', path('MID'), f.otherCoach, body)).status).toBe(403);
    expect((await request('PUT', `/${f.cls.id}/students/${f.outsider.id}/reviews/MID`, f.coach, body)).status).toBe(
      422,
    );

    const detail = await readResult<StudentProgress>(
      await request('GET', `/${f.cls.id}/students/${f.member.id}`, f.coach),
    );
    expect(detail.reviews.map(({ milestone, fitness }) => [milestone, fitness])).toEqual([['MID', 4]]);
  });
});
