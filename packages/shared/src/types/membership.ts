import type { Ref } from './api';
import type { Order } from './checkout';

export interface MembershipPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
  gymAccess: boolean;
  bookingDiscountPct: number;
  classDiscountPct: number;
  freeBookingSlotsPerMonth: number;
  aiQuestionsPerMonth: number;
  isActive: boolean;
}

export type MembershipBenefits = Pick<
  MembershipPackage,
  'gymAccess' | 'bookingDiscountPct' | 'classDiscountPct' | 'freeBookingSlotsPerMonth' | 'aiQuestionsPerMonth'
>;

export interface MembershipPeriod {
  orderItemId: string;
  periodStart: string;
  periodEnd: string;
  paidAmount: number;
  benefits: MembershipBenefits;
}

export interface MemberMembership {
  id: string;
  package: Ref;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  cancelledAt: string | null;
  currentBenefits: MembershipBenefits | null;
  freeSlotsUsedThisMonth: number;
  periods: MembershipPeriod[];
}

export interface MyMemberships {
  current: MemberMembership | null;
  history: MemberMembership[];
}

export interface StaffMembershipResult {
  order: Order;
  membership: MemberMembership;
}
