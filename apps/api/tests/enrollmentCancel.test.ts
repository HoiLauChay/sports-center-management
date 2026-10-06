import type { CancelEnrollmentResult, Order } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';
import { seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/enrollments'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const buy = async (member: Viewer, items: unknown[], expectedTotal: number) => {
  const response = await checkout('POST', '/', member, {
    items,
    paymentMethod: 'WALLET',
    expectedTotal,
    idempotencyKey: `buy-${crypto.randomUUID()}`,
  });
  expect(response.status).toBe(201);
  return readResult<Order>(response);
};

describe('cancel enrollment', () => {
  test('before the start date the class line is refunded in full and the other lines stay paid', async () => {
    const cls = await seedOpenClass();
    const court = await seedFacility(1);
    const member = await createAccount('MEMBER', 'member@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    await seedBalance(member.id, 500_000);
    const order = await buy(
      member,
      [
        {
          type: 'FACILITY_BOOKING',
          facilityId: court.id,
          date: addDays(todayInCenter(), 1),
          startTime: '08:00',
          endTime: '09:00',
        },
        { type: 'COURSE_ENROLLMENT', classId: cls.id },
      ],
      400_000,
    );
    const enrollmentId = order.items[1]!.refId!;

    expect((await request('POST', `/${enrollmentId}/cancel`, other)).status).toBe(404);

    const cancelled = await readResult<CancelEnrollmentResult>(
      await request('POST', `/${enrollmentId}/cancel`, member),
    );
    expect(cancelled).toMatchObject({ refund: 300_000, enrollment: { status: 'CANCELLED', paidAmount: 300_000 } });
    expect(cancelled.enrollment.refundedAt).not.toBeNull();

    const items = await prisma.orderItem.findMany({ orderBy: { lineNumber: 'asc' } });
    expect(items.map(({ type, refundedAt }) => ({ type, refunded: !!refundedAt }))).toEqual([
      { type: 'FACILITY_BOOKING', refunded: false },
      { type: 'COURSE_ENROLLMENT', refunded: true },
    ]);
    expect(await prisma.facilityBooking.count({ where: { status: 'CONFIRMED' } })).toBe(1);
    expect(await expectWalletConsistent(member.id)).toBe(400_000);

    const again = await request('POST', `/${enrollmentId}/cancel`, member);
    expect(again.status).toBe(409);
    expect(await readCode(again)).toBe('INVALID_STATE');
    expect(await expectWalletConsistent(member.id)).toBe(400_000);
  });

  test('from the start date the enrollment can no longer be cancelled, even at the counter', async () => {
    const cls = await seedOpenClass();
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    await seedBalance(member.id, 300_000);
    const order = await buy(member, [{ type: 'COURSE_ENROLLMENT', classId: cls.id }], 300_000);
    await prisma.class.update({ where: { id: cls.id }, data: { startDate: new Date(todayInCenter()) } });

    const late = await request('POST', `/${order.items[0]!.refId}/cancel`, receptionist);
    expect(late.status).toBe(409);
    expect(await readCode(late)).toBe('INVALID_STATE');
    expect(await prisma.classEnrollment.count({ where: { status: 'ENROLLED' } })).toBe(1);
    expect(await expectWalletConsistent(member.id)).toBe(0);
  });
});
