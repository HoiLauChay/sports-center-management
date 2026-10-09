import { prisma } from '~/configs/db';

interface Window {
  from: Date;
  to: Date;
}

const within = ({ from, to }: Window) => ({ gte: from, lt: to });

class ReportRepository {
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
