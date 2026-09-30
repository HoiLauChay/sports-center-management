import type { MembershipPackage } from '@sports-center/shared';

import type { MembershipRow } from '~/repositories/membership.repository';

export const toMembershipResponse = (row: MembershipRow): MembershipPackage => ({
  id: row.id,
  name: row.name,
  description: row.description,
  price: Number(row.price),
  durationDays: row.durationDays,
  gymAccess: row.gymAccess,
  bookingDiscountPct: row.bookingDiscountPct,
  classDiscountPct: row.classDiscountPct,
  freeBookingSlotsPerMonth: row.freeBookingSlotsPerMonth,
  isActive: row.isActive,
});
