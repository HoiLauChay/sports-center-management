import type { CancelClassResult, Order } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import scheduleService from '~/services/schedule.service';
import { addDays, parseTime, todayInCenter, toDbTime } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer, type Viewer } from './helpers/http';
import { seedFacility } from './helpers/schedule';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request } = await startServer('/classes'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const buy = async (member: Viewer, items: unknown[], expectedTotal: number) => {
  await seedBalance(member.id, expectedTotal);
  const response = await checkout('POST', '/', member, {
    items,
    paymentMethod: 'WALLET',
    expectedTotal,
    idempotencyKey: `buy-${crypto.randomUUID()}`,
  });
  expect(response.status).toBe(201);
  return readResult<Order>(response);
};

describe('cancel class', () => {
  test('each student gets the class line back, the other lines stay paid and the slots are free again', async () => {
    const cls = await seedOpenClass();
    const court = await seedFacility(1);
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const [first, second] = await Promise.all(
      ['a@example.com', 'b@example.com'].map((email) => createAccount('MEMBER', email)),
    );
    const booking = {
      type: 'FACILITY_BOOKING',
      facilityId: court.id,
      date: addDays(todayInCenter(), 1),
      startTime: '08:00',
      endTime: '09:00',
    };
    await buy(first!, [booking, { type: 'COURSE_ENROLLMENT', classId: cls.id }], 400_000);
    await buy(second!, [{ type: 'COURSE_ENROLLMENT', classId: cls.id }], 300_000);

    const response = await request('POST', `/${cls.id}/cancel`, manager, { reason: ' HLV nghỉ ' });
    expect(response.status).toBe(200);
    const result = await readResult<CancelClassResult>(response);
    expect(result).toMatchObject({ refundTotal: 600_000, class: { status: 'CANCELLED', cancelReason: 'HLV nghỉ' } });
    expect(result.class.sessions.every(({ status }) => status === 'CANCELLED')).toBe(true);

    expect(await prisma.classEnrollment.count({ where: { status: 'ENROLLED' } })).toBe(0);
    expect(await expectWalletConsistent(first!.id)).toBe(300_000);
    expect(await expectWalletConsistent(second!.id)).toBe(300_000);
    expect(await prisma.orderItem.count({ where: { type: 'FACILITY_BOOKING', refundedAt: null } })).toBe(1);

    const session = await prisma.classSession.findFirstOrThrow({ where: { classId: cls.id } });
    const free = await scheduleService.findConflicts(prisma, {
      ranges: [
        { date: session.sessionDate.toISOString().slice(0, 10), start: parseTime('18:00'), end: parseTime('19:00') },
      ],
      facility: { id: session.facilityId, exclusive: false },
    });
    expect(free).toEqual([]);

    const notified = await prisma.notification.findMany({ where: { type: 'CLASS', referenceId: cls.id } });
    expect(notified.map(({ accountId }) => accountId).sort()).toEqual([cls.coachId!, first!.id, second!.id].sort());
  });

  test('cancelling twice or in parallel refunds each class line only once', async () => {
    const cls = await seedOpenClass();
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const member = await createAccount('MEMBER', 'member@example.com');
    await buy(member, [{ type: 'COURSE_ENROLLMENT', classId: cls.id }], 300_000);

    const responses = await Promise.all(
      ['A', 'B'].map((reason) => request('POST', `/${cls.id}/cancel`, manager, { reason })),
    );
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(await readCode(await request('POST', `/${cls.id}/cancel`, manager, { reason: 'C' }))).toBe('INVALID_STATE');

    expect(await prisma.walletTransaction.count({ where: { type: 'REFUND' } })).toBe(1);
    expect(await expectWalletConsistent(member.id)).toBe(300_000);
  });

  test('a class already under way keeps the sessions that have taken place', async () => {
    const cls = await seedOpenClass({ startDate: addDays(todayInCenter(), -2) });
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await prisma.classSession.create({
      data: {
        classId: cls.id,
        facilityId: cls.facilityId,
        sessionNumber: 3,
        sessionDate: new Date(addDays(todayInCenter(), 5)),
        startTime: toDbTime(parseTime('18:00')),
        endTime: toDbTime(parseTime('19:30')),
        status: 'CANCELLED',
        cancelReason: 'Lý do cũ',
      },
    });

    const result = await readResult<CancelClassResult>(
      await request('POST', `/${cls.id}/cancel`, manager, { reason: 'Dừng lớp' }),
    );
    expect(result.class.sessions.map(({ status, cancelReason }) => [status, cancelReason])).toEqual([
      ['SCHEDULED', null],
      ['CANCELLED', 'Dừng lớp'],
      ['CANCELLED', 'Lý do cũ'],
    ]);
  });
});
