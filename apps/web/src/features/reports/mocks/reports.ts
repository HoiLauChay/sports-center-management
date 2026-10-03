import type { OrderItemType } from '~/features/checkout/types';
import { classesDb } from '~/features/classes/mocks/classes';
import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { walletLedger } from '~/lib/mock/ledger';
import { DATE_FORMAT, addDays, parseDate, todayVN, vnDate } from '~/lib/time';
import type { Granularity, OverviewReport, RevenueBucket, RevenueReport, WalletBucket, WalletReport } from '../types';

/** Deterministic pseudo random in [0, 1) so the same date always shows the same demo figures. */
function random(seed: string, salt: string) {
  let hash = 2166136261;
  for (const char of `${seed}:${salt}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;
  return ((hash >>> 0) % 100_000) / 100_000;
}

const round = (value: number, unit = 10_000) => Math.round(value / unit) * unit;
const weekendBoost = (date: string) => ([0, 6].includes(parseDate(date).day()) ? 1.45 : 1);

interface DayFigures {
  byType: Record<OrderItemType, number>;
  byPaymentMethod: Record<'WALLET' | 'CASH' | 'CARD' | 'TRANSFER', number>;
  refunds: number;
  topUpBank: number;
  topUpCounter: { CASH: number; CARD: number; TRANSFER: number };
}

const emptyDay = (): DayFigures => ({
  byType: { MEMBERSHIP: 0, FACILITY_BOOKING: 0, FACILITY_PACKAGE: 0, COURSE_ENROLLMENT: 0 },
  byPaymentMethod: { WALLET: 0, CASH: 0, CARD: 0, TRANSFER: 0 },
  refunds: 0,
  topUpBank: 0,
  topUpCounter: { CASH: 0, CARD: 0, TRANSFER: 0 },
});

/** Demo history for days before today, plus whatever this browser's mock orders and wallet movements added. */
function figuresOf(date: string): DayFigures {
  const day = emptyDay();
  const boost = weekendBoost(date);
  if (date < todayVN()) {
    day.byType.MEMBERSHIP = round(random(date, 'm') * 3_200_000 * boost);
    day.byType.FACILITY_BOOKING = round((900_000 + random(date, 'b') * 2_600_000) * boost);
    day.byType.FACILITY_PACKAGE = round(random(date, 'p') * 1_800_000 * boost);
    day.byType.COURSE_ENROLLMENT = round(random(date, 'c') * 4_000_000);
    const total = Object.values(day.byType).reduce((sum, value) => sum + value, 0);
    day.byPaymentMethod.WALLET = round(total * (0.52 + random(date, 'w') * 0.1));
    day.byPaymentMethod.CASH = round(total * (0.2 + random(date, 'ca') * 0.06));
    day.byPaymentMethod.CARD = round(total * 0.1);
    day.byPaymentMethod.TRANSFER = Math.max(
      0,
      total - day.byPaymentMethod.WALLET - day.byPaymentMethod.CASH - day.byPaymentMethod.CARD,
    );
    day.refunds = round(total * random(date, 'r') * 0.06);
    day.topUpBank = round(random(date, 'tb') * 2_600_000 * boost, 50_000);
    day.topUpCounter.CASH = round(random(date, 'tc') * 800_000, 50_000);
    day.topUpCounter.CARD = round(random(date, 'tk') * 300_000, 50_000);
    day.topUpCounter.TRANSFER = round(random(date, 'tt') * 400_000, 50_000);
  }

  const { orders } = commerceStore.get();
  for (const order of orders.filter((entry) => vnDate(entry.paidAt) === date)) {
    for (const item of order.items) day.byType[item.type] += item.totalAmount;
    day.byPaymentMethod[order.paymentMethod] += order.totalAmount;
  }
  return day;
}

const addInto = (target: DayFigures, source: DayFigures) => {
  for (const key of Object.keys(target.byType) as OrderItemType[]) target.byType[key] += source.byType[key];
  for (const key of Object.keys(target.byPaymentMethod) as Array<keyof DayFigures['byPaymentMethod']>) {
    target.byPaymentMethod[key] += source.byPaymentMethod[key];
  }
  target.refunds += source.refunds;
  target.topUpBank += source.topUpBank;
  target.topUpCounter.CASH += source.topUpCounter.CASH;
  target.topUpCounter.CARD += source.topUpCounter.CARD;
  target.topUpCounter.TRANSFER += source.topUpCounter.TRANSFER;
};

function periodOf(date: string, granularity: Granularity) {
  if (granularity === 'day') return date;
  if (granularity === 'month') return date.slice(0, 7);
  const day = parseDate(date);
  return day.subtract((day.day() + 6) % 7, 'day').format(DATE_FORMAT);
}

function assertRange(from: string, to: string) {
  const span = parseDate(to).diff(parseDate(from), 'day');
  if (span < 0) throw mockErrors.invalid('query.to', 'Ngày kết thúc phải sau ngày bắt đầu');
  if (span > 730) throw mockErrors.invalid('query.to', 'Khoảng thời gian tối đa 2 năm');
  return span;
}

/** Walks the range day by day and groups the figures by period. */
function bucketize(from: string, to: string, granularity: Granularity) {
  const span = assertRange(from, to);
  const buckets = new Map<string, DayFigures>();
  for (let offset = 0; offset <= span; offset += 1) {
    const date = addDays(from, offset);
    const period = periodOf(date, granularity);
    const bucket = buckets.get(period) ?? emptyDay();
    addInto(bucket, figuresOf(date));
    buckets.set(period, bucket);
  }
  return buckets;
}

export function revenueReport(from: string, to: string, granularity: Granularity): RevenueReport {
  const result: RevenueBucket[] = [...bucketize(from, to, granularity)].map(([period, day]) => {
    const revenue = Object.values(day.byType).reduce((sum, value) => sum + value, 0);
    return {
      period,
      revenue,
      refunds: day.refunds,
      net: revenue - day.refunds,
      byType: day.byType,
      byPaymentMethod: day.byPaymentMethod,
    };
  });
  return { buckets: result };
}

export function walletReport(
  from: string,
  to: string,
  granularity: Granularity,
  unmatched: WalletReport['unmatched'],
): WalletReport {
  const buckets: WalletBucket[] = [...bucketize(from, to, granularity)].map(([period, day]) => {
    const payments = day.byPaymentMethod.WALLET;
    const counter = day.topUpCounter.CASH + day.topUpCounter.CARD + day.topUpCounter.TRANSFER;
    return {
      period,
      topUpBankTransfer: day.topUpBank,
      topUpCounter: day.topUpCounter,
      payments,
      refunds: day.refunds,
      netChange: day.topUpBank + counter - payments + day.refunds,
    };
  });
  const accounts = new Set(commerceStore.get().orders.flatMap((order) => (order.account ? [order.account.id] : [])));
  const mockDelta = [...accounts].reduce((sum, accountId) => sum + walletLedger.delta(accountId), 0);
  return {
    totalBalance: 48_350_000 + mockDelta,
    unmatched,
    buckets,
  };
}

export function overviewReport(unmatchedBankTransactions: number): OverviewReport {
  const today = todayVN();
  const { orders, bookings } = commerceStore.get();
  const todays = orders.filter((order) => vnDate(order.paidAt) === today);
  const baseline = figuresOf(addDays(today, -1));
  const baseRevenue = Object.values(baseline.byType).reduce((sum, value) => sum + value, 0) * 0.45;
  return {
    revenueToday: round(baseRevenue) + todays.reduce((sum, order) => sum + order.totalAmount - order.refundedAmount, 0),
    newMembersToday: 2 + Math.floor(random(today, 'nm') * 5),
    bookingsToday: 9 + bookings.filter((booking) => booking.date === today && booking.status === 'CONFIRMED').length,
    ongoingClasses: classesDb.allClasses().filter((item) => item.derivedStatus === 'ONGOING').length + 3,
    activeMemberships: 124,
    unmatchedBankTransactions,
  };
}
