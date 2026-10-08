import {
  ORDER_ITEM_TYPES,
  PAYMENT_METHODS,
  type OverviewReport,
  type ReportGranularity,
  type ReportRangeQuery,
  type RevenueBucket,
  type RevenueReport,
  type WalletBucket,
  type WalletReport,
} from '@sports-center/shared';

import reportRepository from '~/repositories/report.repository';
import { addDays, toCenterDateTime, todayInCenter } from '~/utils/time';

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

class ReportService {
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
