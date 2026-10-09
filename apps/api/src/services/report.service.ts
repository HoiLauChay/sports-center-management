import {
  ACCOUNT_STATUSES,
  ORDER_ITEM_TYPES,
  PAYMENT_METHODS,
  type CoursesReport,
  type FacilitiesReport,
  type MembersReport,
  type OverviewReport,
  type ReportDateQuery,
  type ReportGranularity,
  type ReportRangeQuery,
  type RevenueBucket,
  type RevenueReport,
  type WalletBucket,
  type WalletReport,
} from '@sports-center/shared';

import reportRepository from '~/repositories/report.repository';
import settingRepository, { type SettingRow } from '~/repositories/setting.repository';
import {
  addDays,
  formatDate,
  fromDbTime,
  generateSlots,
  overlaps,
  toCenterDateTime,
  todayInCenter,
} from '~/utils/time';

const zeroes = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;

const periodOf = (date: string, granularity: ReportGranularity) => {
  if (granularity === 'month') return date.slice(0, 7);
  if (granularity === 'week') return addDays(date, -((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7));
  return date;
};

const periodsBetween = ({ from, to, granularity }: ReportRangeQuery) => {
  const periods: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const period = periodOf(date, granularity);
    if (periods.at(-1) !== period) periods.push(period);
  }
  return periods;
};

const windowOf = (from: string, to: string) => ({
  from: toCenterDateTime(from, 0),
  to: toCenterDateTime(addDays(to, 1), 0),
});

const bucketsOf = <T>(query: ReportRangeQuery, empty: (period: string) => T) =>
  new Map(periodsBetween(query).map((period) => [period, empty(period)]));

const periodAt = (at: Date, granularity: ReportGranularity) => periodOf(todayInCenter(at), granularity);

type FacilityUsage = Awaited<ReturnType<typeof reportRepository.facilityUsage>>[number];

const facilityOccupancy = (facility: FacilityUsage, from: string, to: string, settings: SettingRow) => {
  const grid = generateSlots(
    fromDbTime(settings.openTime),
    fromDbTime(settings.closeTime),
    settings.slotDurationMinutes,
  );
  let available = 0;
  let occupied = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (date < todayInCenter(facility.createdAt) || (facility.deletedAt && date > todayInCenter(facility.deletedAt)))
      continue;
    const bookings = facility.bookings.filter((row) => formatDate(row.bookingDate) === date);
    const sessions = facility.sessions.filter((row) => formatDate(row.sessionDate) === date);
    for (const slot of grid) {
      const startAt = toCenterDateTime(date, slot.start);
      const endAt = toCenterDateTime(date, slot.end);
      if (facility.maintenances.some((row) => row.startAt < endAt && startAt < row.endAt)) continue;
      available += facility.capacityPerSlot;
      const hits = (row: { startTime: Date; endTime: Date }) =>
        overlaps(slot, { start: fromDbTime(row.startTime), end: fromDbTime(row.endTime) });
      occupied += sessions.some(hits)
        ? facility.capacityPerSlot
        : Math.min(bookings.filter(hits).length, facility.capacityPerSlot);
    }
  }
  return { available, occupied };
};

const percentage = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 10_000) / 100 : 0);

class ReportService {
  members = async (query: ReportDateQuery, now = new Date()): Promise<MembersReport> => {
    const today = todayInCenter(now);
    const settings = await settingRepository.get();
    const [counts, newMembers, activeMemberships, expiringSoon, periods] = await Promise.all([
      reportRepository.memberCounts(),
      reportRepository.newMembers(windowOf(query.from, query.to)),
      reportRepository.countActiveMemberships(today),
      reportRepository.countExpiringMemberships(today, addDays(today, settings.membershipExpiryWarningDays)),
      reportRepository.membershipPeriods(query.from, query.to),
    ]);
    const byStatus = zeroes(ACCOUNT_STATUSES);
    for (const row of counts) byStatus[row.status] = row._count._all;
    const days = new Map(periodsBetween({ ...query, granularity: 'day' }).map((period) => [period, 0]));
    for (const member of newMembers) {
      const day = todayInCenter(member.createdAt);
      days.set(day, days.get(day)! + 1);
    }
    const renewed = periods.filter((period) =>
      period.membership.account.memberships.some((membership) =>
        membership.periods.some((next) => formatDate(next.periodStart) === formatDate(period.periodEnd)),
      ),
    ).length;
    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      activeMemberships,
      expiringSoon,
      renewalRate: percentage(renewed, periods.length),
      newByPeriod: [...days].map(([period, count]) => ({ period, count })),
    };
  };

  facilities = async (query: ReportDateQuery): Promise<FacilitiesReport> => {
    const window = windowOf(query.from, query.to);
    const [facilities, sales, settings] = await Promise.all([
      reportRepository.facilityUsage(query.from, query.to, window),
      reportRepository.facilitySales(window),
      settingRepository.get(),
    ]);
    const revenues = new Map<string, number>();
    for (const item of sales) {
      const id = item.facilityPackage?.facilityId ?? item.bookings[0]?.facilityId;
      if (id) revenues.set(id, (revenues.get(id) ?? 0) + Number(item.totalAmount));
    }
    let occupied = 0;
    let available = 0;
    const byFacility = facilities.map((facility) => {
      const usage = facilityOccupancy(facility, query.from, query.to, settings);
      occupied += usage.occupied;
      available += usage.available;
      return {
        facilityId: facility.id,
        name: facility.name,
        bookings: facility.bookings.length,
        occupancyPct: percentage(usage.occupied, usage.available),
        revenue: revenues.get(facility.id) ?? 0,
      };
    });
    return { utilizationRate: percentage(occupied, available), byFacility };
  };

  courses = async (query: ReportDateQuery): Promise<CoursesReport> => {
    const classes = await reportRepository.courseUsage(query.from, query.to);
    const coaches = new Map<string, { coach: CoursesReport['topCoaches'][number]['coach']; students: Set<string> }>();
    const byClass = classes.map((cls) => {
      if (cls.coach && cls.enrollments.length > 0) {
        let row = coaches.get(cls.coach.id);
        if (!row) {
          row = { coach: { id: cls.coach.id, fullName: cls.coach.fullName }, students: new Set() };
          coaches.set(cls.coach.id, row);
        }
        for (const enrollment of cls.enrollments) row.students.add(enrollment.accountId);
      }
      const attendances = cls.sessions.flatMap((session) => session.attendances);
      return {
        classId: cls.id,
        name: cls.name,
        enrolled: cls.enrollments.length,
        max: cls.maxStudents,
        fillRate: percentage(cls.enrollments.length, cls.maxStudents),
        attendanceRate: percentage(
          attendances.filter((row) => row.status === 'PRESENT' || row.status === 'LATE').length,
          attendances.length,
        ),
      };
    });
    const topCoaches = [...coaches.values()]
      .map(({ coach, students }) => ({ coach, students: students.size }))
      .sort(
        (a, b) =>
          b.students - a.students ||
          a.coach.fullName.localeCompare(b.coach.fullName) ||
          a.coach.id.localeCompare(b.coach.id),
      );
    return { byClass, topCoaches };
  };

  overview = async (now = new Date()): Promise<OverviewReport> => {
    const today = todayInCenter(now);
    const window = windowOf(today, today);
    return {
      revenueToday: await reportRepository.sumRevenue(window),
      newMembersToday: await reportRepository.countNewMembers(window),
      bookingsToday: await reportRepository.countBookingsOn(today),
      ongoingClasses: await reportRepository.countOngoingClasses(today),
      activeMemberships: await reportRepository.countActiveMemberships(today),
      unmatchedBankTransactions: (await reportRepository.summarizeUnmatched()).count,
    };
  };

  revenue = async (query: ReportRangeQuery): Promise<RevenueReport> => {
    const window = windowOf(query.from, query.to);
    const buckets = bucketsOf<RevenueBucket>(query, (period) => ({
      period,
      revenue: 0,
      refunds: 0,
      net: 0,
      byType: zeroes(ORDER_ITEM_TYPES),
      byPaymentMethod: zeroes(PAYMENT_METHODS),
    }));

    for (const order of await reportRepository.findOrders(window)) {
      const bucket = buckets.get(periodAt(order.createdAt, query.granularity))!;
      const total = Number(order.totalAmount);
      bucket.revenue += total;
      bucket.byPaymentMethod[order.paymentMethod] += total;
      for (const item of order.items) bucket.byType[item.type] += Number(item.totalAmount);
    }
    for (const refund of await reportRepository.findWalletTransactions(window, 'REFUND')) {
      buckets.get(periodAt(refund.createdAt, query.granularity))!.refunds += Number(refund.amount);
    }

    return { buckets: [...buckets.values()].map((bucket) => ({ ...bucket, net: bucket.revenue - bucket.refunds })) };
  };

  wallet = async (query: ReportRangeQuery): Promise<WalletReport> => {
    const buckets = bucketsOf<WalletBucket>(query, (period) => ({
      period,
      topUpBankTransfer: 0,
      topUpCounter: { CASH: 0, CARD: 0 },
      payments: 0,
      refunds: 0,
      netChange: 0,
    }));

    for (const movement of await reportRepository.findWalletTransactions(windowOf(query.from, query.to))) {
      const bucket = buckets.get(periodAt(movement.createdAt, query.granularity))!;
      const amount = Number(movement.amount);
      if (movement.type === 'PAYMENT') bucket.payments += amount;
      else if (movement.type === 'REFUND') bucket.refunds += amount;
      else if (movement.topUpMethod === 'CASH' || movement.topUpMethod === 'CARD') {
        bucket.topUpCounter[movement.topUpMethod] += amount;
      } else bucket.topUpBankTransfer += amount;
    }

    return {
      totalBalance: await reportRepository.sumWalletBalances(),
      unmatched: await reportRepository.summarizeUnmatched(),
      buckets: [...buckets.values()].map((bucket) => ({
        ...bucket,
        netChange:
          bucket.topUpBankTransfer +
          bucket.topUpCounter.CASH +
          bucket.topUpCounter.CARD -
          bucket.payments +
          bucket.refunds,
      })),
    };
  };
}

export default new ReportService();
