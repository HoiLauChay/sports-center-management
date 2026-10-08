import type { OrderItemType, PaymentMethod } from '../constants/enums';

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
  topUpCounter: { CASH: number; CARD: number };
  payments: number;
  refunds: number;
  netChange: number;
}

export interface WalletReport {
  totalBalance: number;
  unmatched: { count: number; amount: number };
  buckets: WalletBucket[];
}
