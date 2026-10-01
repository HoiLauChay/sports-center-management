import type { MembershipPackage } from '@sports-center/shared';

export type MembershipBenefits = Pick<
  MembershipPackage,
  'gymAccess' | 'bookingDiscountPct' | 'classDiscountPct' | 'freeBookingSlotsPerMonth'
>;
