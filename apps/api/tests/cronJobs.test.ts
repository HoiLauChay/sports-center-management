import type { Order } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import classJobService from '~/services/classJob.service';
import reminderJobService from '~/services/reminderJob.service';
import { addDays, parseTime, toCenterDateTime, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

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

const enroll = async (classId: string, email: string) => {
  const member = await createAccount('MEMBER', email);
  await seedBalance(member.id, 300_000);
  const response = await request('POST', '/checkout', member, {
    items: [{ type: 'COURSE_ENROLLMENT', classId }],
    paymentMethod: 'WALLET',
    expectedTotal: 300_000,
    idempotencyKey: `enroll-${crypto.randomUUID()}`,
  });
  expect(response.status).toBe(201);
  await readResult<Order>(response);
  return member;
};

describe('cron jobs', () => {
  test('a class short of students is cancelled and refunded the day before its first session, once', async () => {
    const startDate = addDays(todayInCenter(), 3);
    const short = await seedOpenClass({ startDate });
    const full = await seedOpenClass({ startDate });
    await prisma.class.updateMany({ where: { id: { in: [short.id, full.id] } }, data: { minStudents: 2 } });
    const student = await enroll(short.id, 'short@example.com');
    await enroll(full.id, 'a@example.com');
    await enroll(full.id, 'b@example.com');

    const now = toCenterDateTime(startDate, parseTime('16:00'));
    expect(await classJobService.cancelUnderfilled(now)).toEqual({ processed: 1, remaining: 0 });
    expect(await prisma.class.findUniqueOrThrow({ where: { id: short.id } })).toMatchObject({ status: 'CANCELLED' });
    expect(await prisma.class.findUniqueOrThrow({ where: { id: full.id } })).toMatchObject({ status: 'OPEN' });
    expect(await expectWalletConsistent(student.id)).toBe(300_000);
    expect(await classJobService.cancelUnderfilled(now)).toEqual({ processed: 0, remaining: 0 });
  });

  test('reminders go out for what starts within the hour and a rerun sends nothing new', async () => {
    const day = addDays(todayInCenter(), 2);
    const member = await createAccount('MEMBER', 'member@example.com');
    const court = await seedFacility(1);
    await seedBooking(court.id, '18:00', '19:00', { date: day, accountId: member.id });
    const cls = await seedOpenClass({ startDate: day, endDate: addDays(day, 7) });
    const student = await enroll(cls.id, 'student@example.com');

    const now = toCenterDateTime(day, parseTime('17:30'));
    expect(await reminderJobService.run(now)).toEqual({ processed: 3, remaining: 0 });
    expect(await reminderJobService.run(now)).toEqual({ processed: 0, remaining: 0 });
    for (const accountId of [member.id, student.id, cls.coachId!]) {
      expect(await prisma.notification.count({ where: { accountId, title: { startsWith: 'Sắp đến giờ' } } })).toBe(1);
    }
  });
});
