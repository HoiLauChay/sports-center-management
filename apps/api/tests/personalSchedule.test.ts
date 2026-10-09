import type { CoachScheduleItem, MemberScheduleItem } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { seedBooking, seedFacility, seedSession } from './helpers/schedule';

import { addDays, todayInCenter } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { seedBalance } from './helpers/wallet';
const FROM = '2026-10-19';
const TO = '2026-10-21';
const QUERY = `?from=${FROM}&to=${TO}`;

// Enrollment requires its own COURSE_ENROLLMENT order item. A booking item cannot
// be reused because orderItemId is unique for bookings and enrollments.
const seedEnrollmentOrderItem = async (accountId: string) => {
  const id = crypto.randomUUID();
  const order = await prisma.order.create({
    data: {
      orderNumber: `SCH166-${id}`,
      idempotencyKey: `schedule166:${id}`,
      accountId,
      receiptSnapshot: { schema_version: 1 },
      subtotal: 0,
      totalAmount: 0,
      paymentMethod: 'CASH',
      items: {
        create: {
          lineNumber: 1,
          type: 'COURSE_ENROLLMENT',
          itemSnapshot: { schema_version: 1 },
          subtotal: 0,
          totalAmount: 0,
        },
      },
    },
    include: { items: true },
  });
  return order.items[0]!.id;
};
let server: Server;
let memberRequest: ReturnType<typeof buildFetcher>;
let coachRequest: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server } = await startServer('/me/schedule'));
  const port = (server.address() as { port: number }).port;
  memberRequest = buildFetcher(`http://localhost:${port}/api/v1/me/schedule`);
  coachRequest = buildFetcher(`http://localhost:${port}/api/v1/coach/schedule`);
});

afterAll(() => server.close());
beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

describe('personal schedule #166', () => {
  test('member receives own bookings and enrolled sessions sorted by date/time, including cancelled', async () => {
    const member = await createAccount('MEMBER', 'member166@example.com');
    const other = await createAccount('MEMBER', 'other166@example.com');
    const coach = await createAccount('COACH', 'coach166@example.com');
    const facility = await seedFacility(2);
    const booking = await seedBooking(facility.id, '08:00', '09:00', { accountId: member.id });
    await seedBooking(facility.id, '07:00', '08:00', { accountId: other.id });
    const session = await seedSession(facility.id, '06:00', '07:00', { coachId: coach.id });
    const enrollmentOrderItemId = await seedEnrollmentOrderItem(member.id);
    await prisma.classEnrollment.create({
      data: { classId: session.classId, accountId: member.id, orderItemId: enrollmentOrderItemId },
    });
    await prisma.classSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
    const response = await memberRequest('GET', QUERY, member);
    expect(response.status).toBe(200);
    const items = await readResult<MemberScheduleItem[]>(response);
    expect(items.map(({ kind }) => kind)).toEqual(['CLASS_SESSION', 'BOOKING']);
    expect(items[0]).toMatchObject({ id: session.id, status: 'CANCELLED', class: { coach: { id: coach.id } } });
    expect(items[1]).toMatchObject({ id: booking.id, status: 'CONFIRMED' });
    expect((await readResult<MemberScheduleItem[]>(await memberRequest('GET', QUERY, other))).length).toBe(1);
  });

  test('coach sees sessions of assigned classes including cancelled, but not other coaches', async () => {
    const coach = await createAccount('COACH', 'coachA166@example.com');
    const other = await createAccount('COACH', 'coachB166@example.com');
    const facility = await seedFacility(2);
    const session = await seedSession(facility.id, '09:00', '10:00', { coachId: coach.id });
    await prisma.classSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
    const response = await coachRequest('GET', QUERY, coach);
    expect(response.status).toBe(200);
    expect(await readResult<CoachScheduleItem[]>(response)).toMatchObject([
      { id: session.id, status: 'CANCELLED', class: { id: session.classId } },
    ]);
    expect(await readResult<CoachScheduleItem[]>(await coachRequest('GET', QUERY, other))).toEqual([]);
  });

  test('cancelled class remains visible after its enrollment is cancelled', async () => {
    const member = await createAccount('MEMBER', 'history166@example.com');
    const coach = await createAccount('COACH', 'historyCoach166@example.com');
    const facility = await seedFacility(1);
    await seedBooking(facility.id, '11:00', '12:00', { accountId: member.id });
    const session = await seedSession(facility.id, '06:00', '07:00', { coachId: coach.id });
    const enrollmentOrderItemId = await seedEnrollmentOrderItem(member.id);
    await prisma.classEnrollment.create({
      data: { classId: session.classId, accountId: member.id, orderItemId: enrollmentOrderItemId, status: 'CANCELLED' },
    });
    await prisma.class.update({ where: { id: session.classId }, data: { status: 'CANCELLED' } });
    await prisma.classSession.update({ where: { id: session.id }, data: { status: 'CANCELLED' } });
    const items = await readResult<MemberScheduleItem[]>(await memberRequest('GET', QUERY, member));
    expect(
      items.some((item) => item.kind === 'CLASS_SESSION' && item.id === session.id && item.status === 'CANCELLED'),
    ).toBe(true);
  });

  test('invalid dates and roles are rejected', async () => {
    const member = await createAccount('MEMBER', 'memberC166@example.com');
    const coach = await createAccount('COACH', 'coachC166@example.com');
    expect((await memberRequest('GET', '?from=2026-10-21&to=2026-10-19', member)).status).toBe(422);
    expect((await memberRequest('GET', '?from=wrong&to=2026-10-21', member)).status).toBe(422);
    expect((await memberRequest('GET', QUERY, coach)).status).toBe(403);
    expect((await coachRequest('GET', QUERY, member)).status).toBe(403);
    expect(await readCode(await coachRequest('GET', '?from=2026-10-21&to=2026-10-19', coach))).toBe('VALIDATION_ERROR');
  });

  test('member and coach retain cancelled sessions after real class cancellation API', async () => {
    const member = await createAccount('MEMBER', 'cancel166@example.com');
    const manager = await createAccount('MANAGER', 'manager166@example.com');
    const cls = await seedOpenClass();

    const from = addDays(todayInCenter(), 1);
    const to = addDays(todayInCenter(), 15);
    const query = `?from=${from}&to=${to}`;

    const port = (server.address() as { port: number }).port;
    const checkoutRequest = buildFetcher(`http://localhost:${port}/api/v1/checkout`);
    const classRequest = buildFetcher(`http://localhost:${port}/api/v1/classes`);

    await seedBalance(member.id, 300_000);

    const checkoutResponse = await checkoutRequest('POST', '/', member, {
      items: [{ type: 'COURSE_ENROLLMENT', classId: cls.id }],
      paymentMethod: 'WALLET',
      expectedTotal: 300_000,
      idempotencyKey: crypto.randomUUID(),
    });

    expect(checkoutResponse.status).toBe(201);

    const before = await memberRequest('GET', query, member);
    expect(before.status).toBe(200);

    const beforeItems = await readResult<MemberScheduleItem[]>(before);
    const sessionsBefore = beforeItems.filter((item) => item.kind === 'CLASS_SESSION' && item.class.id === cls.id);

    expect(sessionsBefore.length).toBe(2);
    expect(sessionsBefore.every((item) => item.status === 'SCHEDULED')).toBe(true);

    const cancelResponse = await classRequest('POST', `/${cls.id}/cancel`, manager, {
      reason: 'Kiểm thử hủy lớp Issue 166',
    });

    expect(cancelResponse.status).toBe(200);

    const after = await memberRequest('GET', query, member);
    expect(after.status).toBe(200);

    const afterItems = await readResult<MemberScheduleItem[]>(after);
    const cancelledSessions = afterItems.filter((item) => item.kind === 'CLASS_SESSION' && item.class.id === cls.id);

    expect(cancelledSessions.length).toBe(2);
    expect(cancelledSessions.every((item) => item.status === 'CANCELLED')).toBe(true);

    const coach = { id: cls.coachId!, role: 'COACH' as const };
    const coachResponse = await coachRequest('GET', query, coach);

    expect(coachResponse.status).toBe(200);

    const coachItems = await readResult<CoachScheduleItem[]>(coachResponse);
    const coachSessions = coachItems.filter((item) => item.class.id === cls.id);

    expect(coachSessions.length).toBe(2);
    expect(coachSessions.every((item) => item.status === 'CANCELLED')).toBe(true);

    const enrollment = await prisma.classEnrollment.findFirstOrThrow({
      where: { accountId: member.id, classId: cls.id },
    });

    expect(enrollment.status).toBe('CANCELLED');
  });
});
