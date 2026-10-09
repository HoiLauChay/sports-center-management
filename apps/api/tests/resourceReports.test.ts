import type { CoursesReport, FacilitiesReport } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import reportService from '~/services/report.service';
import { addDays, toCenterDateTime, todayInCenter, toDbTime } from '~/utils/time';
import { seedOpenClass } from './helpers/class';
import { resetDatabase } from './helpers/db';
import { createAccount, readResult, startServer } from './helpers/http';
import { giveActiveMembership } from './helpers/membership';
import { seedBooking, seedFacility, seedSession } from './helpers/schedule';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
const today = todayInCenter();
const query = { from: today, to: today };
const range = `from=${today}&to=${today}`;
let sequence = 0;

beforeAll(async () => {
  ({ server, request } = await startServer('/reports'));
});
afterAll(() => server.close());
beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: { openTime: toDbTime(6 * 60), closeTime: toDbTime(10 * 60) } });
});

const orderItem = async (
  accountId: string,
  type: 'COURSE_ENROLLMENT' | 'FACILITY_BOOKING' | 'FACILITY_PACKAGE' | 'MEMBERSHIP',
  amount = 0,
  discount = 0,
) => {
  const order = await prisma.order.create({
    data: {
      accountId,
      orderNumber: `REPORT-${++sequence}`,
      idempotencyKey: `report:${sequence}`,
      receiptSnapshot: { schema_version: 1 },
      subtotal: amount + discount,
      couponDiscountAmount: discount,
      totalAmount: amount,
      paymentMethod: 'WALLET',
      items: {
        create: {
          lineNumber: 1,
          type,
          itemSnapshot: { schema_version: 1 },
          subtotal: amount + discount,
          couponDiscountAmount: discount,
          totalAmount: amount,
        },
      },
    },
    include: { items: true },
  });
  return order.items[0]!;
};

const enroll = async (classId: string, accountId: string, status: 'ENROLLED' | 'CANCELLED' = 'ENROLLED') =>
  prisma.classEnrollment.create({
    data: { classId, accountId, status, orderItemId: (await orderItem(accountId, 'COURSE_ENROLLMENT')).id },
  });

describe('resource reports', () => {
  test('renewal measures actual consecutive paid periods, including early payment, not the auto-renew flag', async () => {
    for (const renews of [true, false]) {
      const member = await createAccount('MEMBER', `renew${renews}@example.com`);
      await giveActiveMembership(member.id, {}, today);
      const membership = await prisma.memberMembership.findFirstOrThrow({ where: { accountId: member.id } });
      await prisma.memberMembership.update({ where: { id: membership.id }, data: { autoRenew: !renews } });
      if (renews) {
        const item = await orderItem(member.id, 'MEMBERSHIP', 500_000);
        await prisma.membershipOrder.create({
          data: {
            membershipId: membership.id,
            orderItemId: item.id,
            periodStart: new Date(today),
            periodEnd: new Date(addDays(today, 30)),
            gymAccess: false,
            bookingDiscountPct: 0,
            classDiscountPct: 0,
            freeBookingSlotsPerMonth: 0,
          },
        });
        await prisma.memberMembership.update({
          where: { id: membership.id },
          data: { endDate: new Date(addDays(today, 30)) },
        });
      }
    }
    expect((await reportService.members(query)).renewalRate).toBe(50);
  });

  test('facility occupancy uses capacity, long bookings, exclusive class slots and excludes maintenance', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const court = await seedFacility(2);
    const unused = await seedFacility(1);
    await seedBooking(court.id, '06:00', '08:00', { date: today });
    const cancelled = await seedBooking(court.id, '06:00', '07:00', { date: today });
    await prisma.facilityBooking.update({ where: { id: cancelled.id }, data: { status: 'CANCELLED' } });
    await seedSession(court.id, '08:00', '09:00', { date: today });
    await prisma.facilityMaintenance.create({
      data: {
        facilityId: court.id,
        startAt: toCenterDateTime(today, 9 * 60),
        endAt: toCenterDateTime(today, 10 * 60),
        reason: 'Bảo trì',
        createdById: manager.id,
      },
    });
    const report = await readResult<FacilitiesReport>(await request('GET', `/facilities?${range}`, manager));
    expect(report.byFacility.find((row) => row.facilityId === court.id)).toMatchObject({
      bookings: 1,
      occupancyPct: 66.67,
      revenue: 0,
    });
    expect(report.byFacility.find((row) => row.facilityId === unused.id)?.occupancyPct).toBe(0);
    expect(report.utilizationRate).toBe(40); // 4 occupied units / (6 + 4) available units
  });

  test('class fill and attendance exclude cancelled enrollments and sessions; coach students are distinct', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const first = await seedOpenClass({ startDate: today, endDate: addDays(today, 1), maxStudents: 4 });
    const second = await seedOpenClass({ startDate: today, endDate: addDays(today, 1), maxStudents: 2 });
    await prisma.class.update({ where: { id: second.id }, data: { coachId: first.coachId, deletedAt: new Date() } });
    const students = await Promise.all([1, 2, 3].map((id) => createAccount('MEMBER', `student${id}@example.com`)));
    await enroll(first.id, students[0]!.id);
    await enroll(first.id, students[1]!.id);
    await enroll(first.id, students[2]!.id, 'CANCELLED');
    await enroll(second.id, students[0]!.id);
    const sessions = await prisma.classSession.findMany({
      where: { classId: first.id },
      orderBy: { sessionNumber: 'asc' },
    });
    await prisma.classAttendance.createMany({
      data: students.map((student, index) => ({
        sessionId: sessions[0]!.id,
        accountId: student.id,
        status: (['PRESENT', 'LATE', 'ABSENT'] as const)[index]!,
      })),
    });
    await prisma.classSession.update({ where: { id: sessions[1]!.id }, data: { status: 'CANCELLED' } });
    await prisma.classAttendance.create({
      data: { sessionId: sessions[1]!.id, accountId: students[0]!.id, status: 'ABSENT' },
    });
    const report = await readResult<CoursesReport>(
      await request('GET', `/courses?from=${today}&to=${addDays(today, 1)}`, manager),
    );
    expect(report.byClass.find((row) => row.classId === first.id)).toMatchObject({
      enrolled: 2,
      max: 4,
      fillRate: 50,
      attendanceRate: 66.67,
    });
    expect(report.byClass.find((row) => row.classId === second.id)).toMatchObject({
      enrolled: 1,
      fillRate: 50,
      attendanceRate: 0,
    });
    expect(report.topCoaches).toEqual([{ coach: { id: first.coachId!, fullName: 'COACH' }, students: 2 }]);
    expect((await reportService.courses({ from: addDays(today, 2), to: addDays(today, 3) })).byClass).toEqual([]);
  });
});
