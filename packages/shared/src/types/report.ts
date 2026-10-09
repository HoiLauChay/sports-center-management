import type { AccountStatus, OrderItemType, PaymentMethod } from '../constants/enums';
import type { Person } from './audit';

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

export interface MembersReport {
  total: number;
  byStatus: Record<AccountStatus, number>;
  activeMemberships: number;
  expiringSoon: number;
  renewalRate: number;
  newByPeriod: { period: string; count: number }[];
}

export interface FacilitiesReport {
  utilizationRate: number;
  byFacility: {
    facilityId: string;
    name: string;
    bookings: number;
    occupancyPct: number;
    revenue: number;
  }[];
}

export interface CoursesReport {
  byClass: {
    classId: string;
    name: string;
    enrolled: number;
    max: number;
    fillRate: number;
    attendanceRate: number;
  }[];
  topCoaches: { coach: Person; students: number }[];
}
