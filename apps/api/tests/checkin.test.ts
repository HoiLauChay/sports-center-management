import type { CheckIn } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readCode, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility } from './helpers/schedule';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];

beforeAll(async () => {
  ({ server, request } = await startServer(''));
});

afterAll(() => server.close());

beforeEach(resetDatabase);

describe('check-in', () => {
  test('a member checks in only with a confirmed booking or a live class session today', async () => {
    const today = todayInCenter();
    const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
    const booked = await createAccount('MEMBER', 'booked@example.com');
    const cancelled = await createAccount('MEMBER', 'cancelled@example.com');
    const idle = await createAccount('MEMBER', 'idle@example.com');
    const court = await seedFacility(2);
    await seedBooking(court.id, '08:00', '09:00', { date: today, accountId: booked.id });
    const dropped = await seedBooking(court.id, '09:00', '10:00', { date: today, accountId: cancelled.id });
    await prisma.facilityBooking.update({ where: { id: dropped.id }, data: { status: 'CANCELLED' } });

    const checkIn = (accountId: string) => request('POST', '/checkins', receptionist, { accountId });
    const done = await checkIn(booked.id);
    expect(done.status).toBe(201);
    expect(await readResult<CheckIn>(done)).toMatchObject({
      account: { id: booked.id },
      checkedBy: { id: receptionist.id },
    });
    for (const member of [cancelled, idle]) {
      const refused = await checkIn(member.id);
      expect([refused.status, await readCode(refused)]).toEqual([409, 'CHECKIN_NOT_ALLOWED']);
    }

    const cls = await seedOpenClass({ startDate: today });
    const student = await createAccount('MEMBER', 'student@example.com');
    const order = await prisma.order.create({
      data: {
        orderNumber: 'CHECKIN-1',
        idempotencyKey: 'checkin-1',
        accountId: student.id,
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
    await prisma.classEnrollment.create({
      data: { classId: cls.id, accountId: student.id, orderItemId: order.items[0]!.id },
    });
    expect((await checkIn(student.id)).status).toBe(201);

    const mine = await readResult<CheckIn[]>(await request('GET', `/me/checkins?from=${today}&to=${today}`, booked));
    expect(mine).toHaveLength(1);
    const day = await readResult<CheckIn[]>(await request('GET', '/checkins', receptionist));
    expect(day.map(({ account }) => account.id).sort()).toEqual([booked.id, student.id].sort());
  });
});
