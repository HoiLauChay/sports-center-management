import { prisma } from '~/configs/db';

interface Window {
  from: Date;
  to: Date;
}

const within = ({ from, to }: Window) => ({ gte: from, lt: to });

class ReportRepository {
  memberCounts = () => prisma.account.groupBy({ by: ['status'], where: { role: 'MEMBER' }, _count: { _all: true } });

  newMembers = (window: Window) =>
    prisma.account.findMany({
      where: { role: 'MEMBER', createdAt: within(window) },
      select: { createdAt: true },
    });

  countExpiringMemberships = (today: string, warningDate: string) =>
    prisma.memberMembership.count({
      where: {
        status: 'ACTIVE',
        startDate: { lte: new Date(today) },
        endDate: { gt: new Date(today), lte: new Date(warningDate) },
      },
    });

  membershipPeriods = (from: string, to: string) =>
    prisma.membershipOrder.findMany({
      where: { periodEnd: { gte: new Date(from), lte: new Date(to) } },
      select: {
        periodEnd: true,
        membership: {
          select: {
            account: {
              select: {
                memberships: {
                  select: {
                    periods: {
                      where: { periodStart: { gte: new Date(from), lte: new Date(to) } },
                      select: { periodStart: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

  facilityUsage = (from: string, to: string, window: Window) =>
    prisma.facility.findMany({
      select: {
        id: true,
        name: true,
        capacityPerSlot: true,
        createdAt: true,
        deletedAt: true,
        bookings: {
          where: { status: 'CONFIRMED', bookingDate: { gte: new Date(from), lte: new Date(to) } },
          select: { bookingDate: true, startTime: true, endTime: true },
        },
        sessions: {
          where: {
            status: 'SCHEDULED',
            class: { status: { not: 'CANCELLED' } },
            sessionDate: { gte: new Date(from), lte: new Date(to) },
          },
          select: { sessionDate: true, startTime: true, endTime: true },
        },
        maintenances: {
          where: { deletedAt: null, startAt: { lt: window.to }, endAt: { gt: window.from } },
          select: { startAt: true, endAt: true },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

  facilitySales = (window: Window) =>
    prisma.orderItem.findMany({
      where: { type: { in: ['FACILITY_BOOKING', 'FACILITY_PACKAGE'] }, order: { createdAt: within(window) } },
      select: {
        totalAmount: true,
        facilityPackage: { select: { facilityId: true } },
        bookings: { take: 1, select: { facilityId: true } },
      },
    });

  courseUsage = (from: string, to: string) =>
    prisma.class.findMany({
      where: {
        status: { in: ['OPEN', 'CANCELLED'] },
        startDate: { lte: new Date(to) },
        endDate: { gte: new Date(from) },
      },
      select: {
        id: true,
        name: true,
        maxStudents: true,
        coach: { select: { id: true, fullName: true } },
        enrollments: { where: { status: 'ENROLLED' }, select: { accountId: true } },
        sessions: {
          where: { status: 'SCHEDULED', sessionDate: { gte: new Date(from), lte: new Date(to) } },
          select: { attendances: { select: { status: true } } },
        },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });

  findOrders = (window: Window) =>
    prisma.order.findMany({
      where: { createdAt: within(window) },
      select: {
        createdAt: true,
        totalAmount: true,
        paymentMethod: true,
        items: { select: { type: true, totalAmount: true } },
      },
    });

  findWalletTransactions = (window: Window, type?: 'REFUND') =>
    prisma.walletTransaction.findMany({
      where: { createdAt: within(window), type },
      select: { createdAt: true, type: true, topUpMethod: true, amount: true },
    });

  sumRevenue = async (window: Window) =>
    Number(
      (await prisma.order.aggregate({ where: { createdAt: within(window) }, _sum: { totalAmount: true } }))._sum
        .totalAmount ?? 0,
    );

  countNewMembers = (window: Window) => prisma.account.count({ where: { role: 'MEMBER', createdAt: within(window) } });

  countBookingsOn = (date: string) =>
    prisma.facilityBooking.count({ where: { status: 'CONFIRMED', bookingDate: new Date(date) } });

  countOngoingClasses = (today: string) =>
    prisma.class.count({
      where: { status: 'OPEN', startDate: { lte: new Date(today) }, endDate: { gte: new Date(today) } },
    });

  countActiveMemberships = (today: string) =>
    prisma.memberMembership.count({
      where: { status: 'ACTIVE', startDate: { lte: new Date(today) }, endDate: { gt: new Date(today) } },
    });

  summarizeUnmatched = async () => {
    const result = await prisma.bankTransaction.aggregate({
      where: { status: 'UNMATCHED' },
      _count: { _all: true },
      _sum: { amount: true },
    });
    return { count: result._count._all, amount: Number(result._sum.amount ?? 0) };
  };

  sumWalletBalances = async () =>
    Number((await prisma.memberProfile.aggregate({ _sum: { walletBalance: true } }))._sum.walletBalance ?? 0);
}

export default new ReportRepository();
