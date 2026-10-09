import type { CoursesReport, FacilitiesReport, MembersReport } from '@sports-center/shared';
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

describe('resource reports #182', () => {
  test('only the manager can access all three reports; unauthenticated requests are rejected', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const roles = await Promise.all(
      ['MEMBER', 'COACH', 'RECEPTIONIST'].map((role) =>
        createAccount(role as 'MEMBER' | 'COACH' | 'RECEPTIONIST', `${role}@example.com`),
      ),
    );
    for (const endpoint of ['members', 'facilities', 'courses']) {
      expect((await request('GET', `/${endpoint}?${range}`, manager)).status).toBe(200);
      for (const viewer of roles) expect((await request('GET', `/${endpoint}?${range}`, viewer)).status).toBe(403);
      const port = (server.address() as { port: number }).port;
      expect((await fetch(`http://localhost:${port}/api/v1/reports/${endpoint}?${range}`)).status).toBe(401);
    }
  });

  test('validates required dates, real dates, ordering and the 366-day inclusive limit', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    for (const endpoint of ['members', 'facilities', 'courses']) {
      for (const invalid of [
        '',
        'from=2026-02-30&to=2026-03-01',
        'from=2026-10-10&to=2026-10-09',
        `from=${today}&to=${addDays(today, 366)}`,
      ]) {
        expect((await request('GET', `/${endpoint}?${invalid}`, manager)).status).toBe(422);
      }
      expect((await request('GET', `/${endpoint}?from=${today}&to=${addDays(today, 365)}`, manager)).status).toBe(200);
    }
  });

  test('empty data returns zero percentages and one daily member bucket', async () => {
    expect(await reportService.members(query)).toEqual({
      total: 0,
      byStatus: { ACTIVE: 0, INACTIVE: 0, BANNED: 0 },
      activeMemberships: 0,
      expiringSoon: 0,
      renewalRate: 0,
      newByPeriod: [{ period: today, count: 0 }],
    });
    expect(await reportService.facilities(query)).toEqual({ utilizationRate: 0, byFacility: [] });
    expect(await reportService.courses(query)).toEqual({ byClass: [], topCoaches: [] });
  });

  test('member status totals exclude other roles and new members use VN midnight boundaries', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    await createAccount('MEMBER', 'active@example.com', { createdAt: toCenterDateTime(today, 0) });
    await createAccount('MEMBER', 'inactive@example.com', {
      status: 'INACTIVE',
      createdAt: new Date(toCenterDateTime(today, 0).getTime() - 1),
    });
    await createAccount('MEMBER', 'banned@example.com', {
      status: 'BANNED',
      createdAt: new Date(toCenterDateTime(addDays(today, 1), 0).getTime() - 1),
    });
    await createAccount('MEMBER', 'next@example.com', { createdAt: toCenterDateTime(addDays(today, 1), 0) });
    const result = await readResult<MembersReport>(await request('GET', `/members?${range}`, manager));
    expect(result).toMatchObject({
      total: 4,
      byStatus: { ACTIVE: 2, INACTIVE: 1, BANNED: 1 },
      newByPeriod: [{ period: today, count: 2 }],
    });
  });

  test('active and expiring memberships use current dates, exclusive end dates and configured warning days', async () => {
    const days = [0, 3, 4, 20];
    await prisma.systemSetting.update({ where: { id: 1 }, data: { membershipExpiryWarningDays: 3 } });
    for (const daysLeft of days) {
      const member = await createAccount('MEMBER', `expiry${daysLeft}@example.com`);
      await giveActiveMembership(member.id, {}, addDays(today, daysLeft));
    }
    const result = await reportService.members({ from: addDays(today, -50), to: addDays(today, -40) });
    expect(result).toMatchObject({ activeMemberships: 3, expiringSoon: 1 });
  });

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

  test('facility sales count each discounted package once and use purchase dates even when bookings are cancelled', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const court = await seedFacility(2);
    const item = await orderItem(member.id, 'FACILITY_PACKAGE', 180_000, 20_000);
    const pkg = await prisma.facilityPackage.create({
      data: {
        accountId: member.id,
        facilityId: court.id,
        orderItemId: item.id,
        daysOfWeek: [1],
        startDate: new Date(today),
        endDate: new Date(addDays(today, 7)),
        startTime: toDbTime(6 * 60),
        endTime: toDbTime(7 * 60),
        unitPrice: 100_000,
      },
    });
    await prisma.facilityBooking.createMany({
      data: [today, addDays(today, 7)].map((date) => ({
        accountId: member.id,
        facilityId: court.id,
        packageId: pkg.id,
        orderItemId: item.id,
        bookingDate: new Date(date),
        startTime: toDbTime(6 * 60),
        endTime: toDbTime(7 * 60),
        unitPrice: 100_000,
        status: 'CANCELLED' as const,
      })),
    });
    await prisma.facility.update({ where: { id: court.id }, data: { deletedAt: new Date(), isActive: false } });
    const result = await reportService.facilities({ from: today, to: addDays(today, 7) });
    expect(result.byFacility[0]).toMatchObject({ facilityId: court.id, bookings: 0, revenue: 180_000 });
    expect(
      (await reportService.facilities({ from: addDays(today, 1), to: addDays(today, 7) })).byFacility[0]?.revenue,
    ).toBe(0);
  });

  test('a fully maintained facility has zero utilization without NaN', async () => {
    const manager = await createAccount('MANAGER', 'manager@example.com');
    const court = await seedFacility(2);
    await prisma.facilityMaintenance.create({
      data: {
        facilityId: court.id,
        startAt: toCenterDateTime(today, 0),
        endAt: toCenterDateTime(addDays(today, 1), 0),
        reason: 'Đóng cả ngày',
        createdById: manager.id,
      },
    });
    expect(await reportService.facilities(query)).toMatchObject({
      utilizationRate: 0,
      byFacility: [{ occupancyPct: 0 }],
    });
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
