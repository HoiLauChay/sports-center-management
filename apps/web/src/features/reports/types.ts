import type { PaymentMethod } from '@sports-center/shared';
import type { OrderItemType } from '~/features/checkout/types';

export const GRANULARITIES = ['day', 'week', 'month'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const GRANULARITY_LABEL: Record<Granularity, string> = { day: 'Ngày', week: 'Tuần', month: 'Tháng' };

export interface ReportRange {
  from: string;
  to: string;
  granularity: Granularity;
}

export interface OverviewReport {
  revenueToday: number;
  newMembersToday: number;
  bookingsToday: number;
  ongoingClasses: number;
  activeMemberships: number;
  unmatchedBankTransactions: number;
}

export interface RevenueBucket {
  period: string;
  revenue: number;
  refunds: number;
  net: number;
  byType: Record<OrderItemType, number>;
  byPaymentMethod: Record<PaymentMethod, number>;
}

export interface RevenueReport {
  buckets: RevenueBucket[];
}

export interface WalletBucket {
  period: string;
  topUpBankTransfer: number;
  topUpCounter: { CASH: number; CARD: number; TRANSFER: number };
  payments: number;
  refunds: number;
  netChange: number;
}

export interface WalletReport {
  totalBalance: number;
  unmatched: { count: number; amount: number };
  buckets: WalletBucket[];
}
