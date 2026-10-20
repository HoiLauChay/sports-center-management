import type { AccountSummary } from '@sports-center/shared';
import type { DraftBuyer } from '~/features/checkout/store/cartStore';
import type { MembershipBenefits } from '~/features/memberships/types';
import { parseDate, todayVN, vnDate } from '~/lib/time';

/** Id of the counter's customer search box, focused by Ctrl+K and after each finished order. */
export const CUSTOMER_SEARCH_ID = 'counter-customer-search';

export function memberToBuyer(member: Pick<AccountSummary, 'id' | 'fullName' | 'phone'>): DraftBuyer {
  return { kind: 'MEMBER', accountId: member.id, fullName: member.fullName, phone: member.phone };
}

export function benefitsText(benefits: MembershipBenefits) {
  return [
    benefits.gymAccess ? 'Gym miễn phí' : '',
    benefits.bookingDiscountPct ? `−${benefits.bookingDiscountPct}% sân` : '',
    benefits.classDiscountPct ? `−${benefits.classDiscountPct}% lớp` : '',
    benefits.freeBookingSlotsPerMonth ? `${benefits.freeBookingSlotsPerMonth} slot free/tháng` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Whole days from today (Vietnam time) until `date`; negative once it has passed. */
export function daysUntil(date: string) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : vnDate(date);
  return parseDate(day).diff(parseDate(todayVN()), 'day');
}

/** Notes a customer is likely to hand over: the total rounded up to the next 50k / 100k / 200k / 500k. */
export function cashSuggestions(total: number) {
  const values = new Set<number>();
  for (const step of [50_000, 100_000, 200_000, 500_000]) {
    const rounded = Math.ceil(total / step) * step;
    if (rounded > total) values.add(rounded);
  }
  return [...values].sort((a, b) => a - b).slice(0, 3);
}
