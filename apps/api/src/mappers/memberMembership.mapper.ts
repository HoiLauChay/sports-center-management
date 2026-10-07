import type { MemberMembership, MembershipBenefits } from '@sports-center/shared';

import type { MemberMembershipRow } from '~/repositories/memberMembership.repository';
import { formatDate } from '~/utils/time';

const benefitsOf = (period: MembershipBenefits): MembershipBenefits => ({
  gymAccess: period.gymAccess,
  bookingDiscountPct: period.bookingDiscountPct,
  classDiscountPct: period.classDiscountPct,
  freeBookingSlotsPerMonth: period.freeBookingSlotsPerMonth,
});

export const isMembershipCurrent = (
  row: Pick<MemberMembershipRow, 'status' | 'startDate' | 'endDate'>,
  today: string,
) => row.status === 'ACTIVE' && formatDate(row.startDate) <= today && today < formatDate(row.endDate);

export const toMemberMembershipResponse = (
  row: MemberMembershipRow,
  today: string,
  freeSlotsUsedThisMonth: number,
): MemberMembership => {
  const period = isMembershipCurrent(row, today)
    ? row.periods.find(
        ({ periodStart, periodEnd }) => formatDate(periodStart) <= today && today < formatDate(periodEnd),
      )
    : null;
  return {
    id: row.id,
    package: { id: row.package.id, name: row.package.name },
    status: row.status === 'ACTIVE' && formatDate(row.endDate) <= today ? 'EXPIRED' : row.status,
    startDate: formatDate(row.startDate),
    endDate: formatDate(row.endDate),
    autoRenew: row.autoRenew,
    currentBenefits: period ? benefitsOf(period) : null,
    freeSlotsUsedThisMonth,
    periods: row.periods.map((period) => ({
      orderItemId: period.orderItemId,
      periodStart: formatDate(period.periodStart),
      periodEnd: formatDate(period.periodEnd),
      paidAmount: Number(period.orderItem.totalAmount),
      benefits: benefitsOf(period),
    })),
  };
};
