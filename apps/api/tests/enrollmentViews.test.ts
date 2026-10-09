import type { Enrollment, MyEnrollment } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';
import { seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
beforeAll(async () => {
  ({ server, request } = await startServer(''));
});
afterAll(() => server.close());
beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const enroll = async (
  member: { id: string; role: 'MEMBER' | 'COACH' | 'MANAGER' | 'RECEPTIONIST' },
  classId: string,
) => {
  await seedBalance(member.id, 500000);
  const response = await request('POST', '/checkout', member, {
    items: [{ type: 'COURSE_ENROLLMENT', classId }],
    expectedTotal: 300000,
    paymentMethod: 'WALLET',
    idempotencyKey: crypto.randomUUID(),
  });
  expect(response.status).toBe(201);
  return prisma.classEnrollment.findFirstOrThrow({ where: { accountId: member.id, classId } });
};

describe('enrollment and coach student access', () => {
  test('member sees full class summaries and cancelled history, staff see class enrollments', async () => {
    const cls = await seedOpenClass();
    const member = await createAccount('MEMBER', 'member@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const enrollment = await enroll(member, cls.id);
    const mine = await readResult<MyEnrollment[]>(await request('GET', '/me/enrollments', member));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      id: enrollment.id,
      paidAmount: 300000,
      class: {
        id: cls.id,
        name: cls.name,
        status: 'OPEN',
        derivedStatus: 'UPCOMING',
        enrolledCount: 1,
        coach: { id: cls.coachId },
      },
    });
    expect(mine[0]?.class.course).toHaveProperty('price');
    expect(await readResult<unknown[]>(await request('GET', '/me/enrollments', other))).toEqual([]);
    expect((await request('GET', `/classes/${cls.id}/enrollments`, member)).status).toBe(403);
    for (const role of ['MANAGER', 'RECEPTIONIST'] as const) {
      const staff = await createAccount(role, `${role}@example.com`);
      const list = await readResult<Enrollment[]>(await request('GET', `/classes/${cls.id}/enrollments`, staff));
      expect(list[0]).toMatchObject({
        id: enrollment.id,
        class: { id: cls.id, name: cls.name },
        account: { id: member.id },
      });
      expect((await request('GET', '/me/enrollments', staff)).status).toBe(403);
      expect((await request('GET', `/classes/${crypto.randomUUID()}/enrollments`, staff)).status).toBe(404);
      expect((await request('GET', '/classes/not-a-uuid/enrollments', staff)).status).toBe(422);
    }
    expect((await request('POST', `/enrollments/${enrollment.id}/cancel`, member)).status).toBe(200);
    const history = await readResult<MyEnrollment[]>(await request('GET', '/me/enrollments', member));
    expect(history[0]).toMatchObject({ status: 'CANCELLED', class: { enrolledCount: 0 } });
    expect(history[0]?.refundedAt).not.toBeNull();
  });

  test('coach cannot read another roster or student, loses profile access after cancellation or reassignment', async () => {
    const cls = await seedOpenClass();
    const otherClass = await seedOpenClass();
    const coach = { id: cls.coachId!, role: 'COACH' as const };
    const otherCoach = { id: otherClass.coachId!, role: 'COACH' as const };
    const member = await createAccount('MEMBER', 'member@example.com', {
      memberProfile: { create: { healthNotes: 'Đau gối', fitnessGoals: 'Tăng sức bền' } },
    });
    const foreign = await createAccount('MEMBER', 'foreign@example.com');
    const enrollment = await enroll(member, cls.id);
    await enroll(foreign, otherClass.id);
    expect((await request('GET', `/classes/${cls.id}/enrollments`, coach)).status).toBe(200);
    expect((await request('GET', `/classes/${otherClass.id}/enrollments`, coach)).status).toBe(403);
    expect((await request('GET', `/users/${foreign.id}`, coach)).status).toBe(404);
    expect((await request('GET', `/users/${member.id}`, otherCoach)).status).toBe(404);
    const response = await request('GET', `/users/${member.id}`, coach);
    expect(response.status).toBe(200);
    const detail = await readResult<Record<string, unknown>>(response);
    expect(detail).toMatchObject({ id: member.id, role: 'MEMBER', profile: { healthNotes: 'Đau gối' } });
    expect(detail).not.toHaveProperty('passwordHash');
    expect((await request('GET', '/users', coach)).status).toBe(403);
    expect((await request('GET', `/users/${coach.id}`, coach)).status).toBe(404);
    expect((await request('GET', `/users/${member.id}/wallet`, coach)).status).toBe(403);
    expect((await request('GET', `/users/${member.id}/memberships`, coach)).status).toBe(403);
    expect((await request('PATCH', `/users/${member.id}`, coach, { fullName: 'Invalid' })).status).toBe(403);
    expect((await request('GET', '/me/enrollments', coach)).status).toBe(403);
    await prisma.class.update({ where: { id: cls.id }, data: { coachId: otherCoach.id } });
    expect((await request('GET', `/users/${member.id}`, coach)).status).toBe(404);
    expect((await request('GET', `/classes/${cls.id}/enrollments`, coach)).status).toBe(403);
    expect((await request('GET', `/users/${member.id}`, otherCoach)).status).toBe(200);
    expect((await request('POST', `/enrollments/${enrollment.id}/cancel`, member)).status).toBe(200);
    expect((await request('GET', `/users/${member.id}`, otherCoach)).status).toBe(404);
  });

  test('completed, cancelled and deleted classes do not grant student profile access', async () => {
    const cls = await seedOpenClass();
    const coach = { id: cls.coachId!, role: 'COACH' as const };
    const member = await createAccount('MEMBER', 'member@example.com');
    await enroll(member, cls.id);
    const today = todayInCenter();
    await prisma.class.update({
      where: { id: cls.id },
      data: { startDate: new Date(addDays(today, -1)), endDate: new Date(today) },
    });
    expect((await request('GET', `/users/${member.id}`, coach)).status).toBe(200);
    await prisma.class.update({
      where: { id: cls.id },
      data: { startDate: new Date(addDays(today, -2)), endDate: new Date(addDays(today, -1)) },
    });
    expect((await request('GET', `/users/${member.id}`, coach)).status).toBe(404);
    await prisma.class.update({
      where: { id: cls.id },
      data: { endDate: new Date(addDays(today, 1)), status: 'CANCELLED' },
    });
    expect((await request('GET', `/users/${member.id}`, coach)).status).toBe(404);
    await prisma.class.update({ where: { id: cls.id }, data: { status: 'OPEN', deletedAt: new Date() } });
    expect((await request('GET', `/users/${member.id}`, coach)).status).toBe(404);
    expect((await request('GET', `/classes/${cls.id}/enrollments`, coach)).status).toBe(404);
  });
});
