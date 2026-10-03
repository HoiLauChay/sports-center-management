import type { MembershipPackage, Ref } from '@sports-center/shared';

export type MembershipBenefits = Pick<
  MembershipPackage,
  'gymAccess' | 'bookingDiscountPct' | 'classDiscountPct' | 'freeBookingSlotsPerMonth'
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
  currentBenefits: MembershipBenefits | null;
  freeSlotsUsedThisMonth: number;
  periods: MembershipPeriod[];
}

export interface MyMemberships {
  current: MemberMembership | null;
  history: MemberMembership[];
}
