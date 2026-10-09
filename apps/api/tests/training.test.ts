import type { AnnouncementResult, Evaluation, SessionNote } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer, type Viewer } from './helpers/http';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let seq = 0;

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());

beforeEach(resetDatabase);

const enroll = async (classId: string, accountId: string) => {
  const order = await prisma.order.create({
    data: {
      orderNumber: `TRAINING-${++seq}`,
      idempotencyKey: `training-${seq}`,
      accountId,
      paymentMethod: 'WALLET',
      subtotal: 0,
      totalAmount: 0,
      receiptSnapshot: { schema_version: 1 },
      items: {
        create: {
          lineNumber: 1,
          type: 'COURSE_ENROLLMENT',
          subtotal: 0,
          totalAmount: 0,
          itemSnapshot: { schema_version: 1 },
        },
      },
    },
    include: { items: true },
  });
  await prisma.classEnrollment.create({ data: { classId, accountId, orderItemId: order.items[0]!.id } });
};

const setup = async () => {
  const cls = await seedOpenClass();
  const session = await prisma.classSession.findFirstOrThrow({ where: { classId: cls.id, sessionNumber: 1 } });
  const coach: Viewer = { id: cls.coachId!, role: 'COACH' };
  const student = await createAccount('MEMBER', 'student@example.com');
  const outsider = await createAccount('MEMBER', 'outsider@example.com');
  const otherCoach = await createAccount('COACH', 'other-coach@example.com');
  await enroll(cls.id, student.id);
  return { cls, session, coach, student, outsider, otherCoach };
};

describe('training', () => {
  test('a deleted evaluation can be given again while the old one is kept', async () => {
    const { session, coach, student, otherCoach } = await setup();
    const evaluate = (who: Viewer, rating: number) =>
      request('POST', `/sessions/${session.id}/evaluations`, who, { accountId: student.id, rating });

    expect((await evaluate(otherCoach, 4)).status).toBe(403);
    const first = await readResult<Evaluation>(await evaluate(coach, 4));
    expect(first).toMatchObject({ rating: 4, account: { id: student.id }, coach: { id: coach.id } });
    expect((await evaluate(coach, 5)).status).toBe(409);
    expect(await prisma.notification.count({ where: { accountId: student.id, type: 'TRAINING' } })).toBe(1);

    expect((await request('DELETE', `/evaluations/${first.id}`, coach)).status).toBe(200);
    const second = await readResult<Evaluation>(await evaluate(coach, 5));
    expect(second.id).not.toBe(first.id);
    expect(await prisma.memberEvaluation.count()).toBe(2);
    const mine = await readResult<Evaluation[]>(await request('GET', '/me/evaluations', student));
    expect(mine.map(({ id, rating }) => [id, rating])).toEqual([[second.id, 5]]);
  });

  test('the coach writes the session note for the class and notifies its students', async () => {
    const { cls, session, coach, student, outsider } = await setup();
    const note = { title: 'Buổi 1', content: 'Khởi động và kỹ thuật cơ bản' };
    expect(
      await readResult<SessionNote>(await request('PUT', `/sessions/${session.id}/notes`, coach, note)),
    ).toMatchObject({ ...note, attachments: [] });
    expect(await readResult<SessionNote>(await request('GET', `/sessions/${session.id}/notes`, student))).toMatchObject(
      note,
    );
    expect((await request('GET', `/sessions/${session.id}/notes`, outsider)).status).toBe(403);

    const sent = await request('POST', `/classes/${cls.id}/announcements`, coach, {
      title: 'Nghỉ lễ',
      body: 'Lớp nghỉ thứ Hai',
    });
    expect(await readResult<AnnouncementResult>(sent)).toEqual({ recipients: 1 });
    expect(await prisma.notification.count({ where: { accountId: student.id, title: 'Nghỉ lễ' } })).toBe(1);
  });
});
