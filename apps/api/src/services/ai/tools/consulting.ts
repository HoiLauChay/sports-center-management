import type { MembershipPackage } from '@sports-center/shared';

import assistantRepository from '~/repositories/assistant.repository';
import memberMembershipService from '~/services/memberMembership.service';
import membershipService from '~/services/membership.service';
import settingService from '~/services/setting.service';
import { percentOf, roundMoney } from '~/utils/money';
import { addDays, formatDate, fromDbTime, todayInCenter } from '~/utils/time';

/** How far back the member's habits are read; the result is shown per month. */
const USAGE_DAYS = 60;
const MONTHS = USAGE_DAYS / 30;

interface UsedSlots {
  month: string;
  slots: number;
  unitPrice: number;
  gym: boolean;
}

/**
 * What the member's last two months would have cost with `pkg`, using the checkout's order of benefits: gym slots
 * free with gym access, then the month's free slots, then the booking discount; classes get the class discount.
 */
const costWith = (pkg: MembershipPackage, bookings: UsedSlots[], classFees: number[]) => {
  const freeLeft = new Map<string, number>();
  let bookingCost = 0;
  for (const { month, slots, unitPrice, gym } of bookings) {
    const subtotal = unitPrice * slots;
    if (gym && pkg.gymAccess) continue;
    const free = freeLeft.get(month) ?? pkg.freeBookingSlotsPerMonth;
    if (free >= slots) {
      freeLeft.set(month, free - slots);
      continue;
    }
    bookingCost += subtotal - percentOf(subtotal, pkg.bookingDiscountPct);
  }
  const classCost = classFees.reduce((sum, fee) => sum + fee - percentOf(fee, pkg.classDiscountPct), 0);
  return { bookingCost, classCost };
};

/**
 * Compares every membership on sale against the member's own spending over the last 60 days, per month. Done in
 * code so the assistant quotes figures instead of doing sums itself.
 */
export const compareMemberships = async (accountId: string) => {
  const today = todayInCenter();
  const from = addDays(today, -USAGE_DAYS);
  const [settings, rawBookings, enrollments, packages, memberships] = await Promise.all([
    settingService.get(),
    assistantRepository.findBookingUsage(accountId, new Date(from), new Date(today)),
    assistantRepository.findEnrollmentUsage(accountId, new Date(`${from}T00:00:00+07:00`)),
    membershipService.list(false),
    memberMembershipService.list(accountId),
  ]);

  const bookings: UsedSlots[] = rawBookings.map((booking) => ({
    month: formatDate(booking.bookingDate).slice(0, 7),
    slots: Math.max(
      1,
      Math.round((fromDbTime(booking.endTime) - fromDbTime(booking.startTime)) / settings.slotDurationMinutes),
    ),
    unitPrice: Number(booking.unitPrice),
    gym: booking.facility.type === 'GYM',
  }));
  const classFees = enrollments.map(({ class: cls }) => Number(cls.course.price));
  const perMonth = (amount: number) => roundMoney(amount / MONTHS);

  const bookingSpend = bookings.reduce((sum, { slots, unitPrice }) => sum + slots * unitPrice, 0);
  const classSpend = classFees.reduce((sum, fee) => sum + fee, 0);
  const withoutMembership = perMonth(bookingSpend + classSpend);
  const current = memberships.current?.status === 'ACTIVE' ? memberships.current.package.name : null;

  const options = packages
    .map((pkg) => {
      const { bookingCost, classCost } = costWith(pkg, bookings, classFees);
      const feePerMonth = roundMoney((pkg.price * 30) / pkg.durationDays);
      const usagePerMonth = perMonth(bookingCost + classCost);
      return {
        packageId: pkg.id,
        name: pkg.name,
        priceVnd: pkg.price,
        durationDays: pkg.durationDays,
        feePerMonthVnd: feePerMonth,
        spendingPerMonthWithPackageVnd: usagePerMonth,
        totalPerMonthVnd: feePerMonth + usagePerMonth,
        savingPerMonthVnd: withoutMembership - (feePerMonth + usagePerMonth),
        benefits: {
          gymAccess: pkg.gymAccess,
          bookingDiscountPct: pkg.bookingDiscountPct,
          classDiscountPct: pkg.classDiscountPct,
          freeBookingSlotsPerMonth: pkg.freeBookingSlotsPerMonth,
          aiQuestionsPerMonth: pkg.aiQuestionsPerMonth,
        },
      };
    })
    .sort((a, b) => b.savingPerMonthVnd - a.savingPerMonthVnd);

  return {
    basedOn: `${USAGE_DAYS} ngày qua (${from} đến ${today}), quy ra mỗi tháng`,
    currentMembership: current,
    usagePerMonth: {
      bookedSlots: roundMoney(bookings.reduce((sum, { slots }) => sum + slots, 0) / MONTHS),
      gymSlots: roundMoney(bookings.filter(({ gym }) => gym).reduce((sum, { slots }) => sum + slots, 0) / MONTHS),
      classesJoined: classFees.length,
      spendingVnd: withoutMembership,
    },
    options,
    meaning:
      'spendingVnd: trung bình mỗi tháng nếu trả giá gốc. totalPerMonthVnd: phí gói chia theo tháng + chi tiêu còn lại sau quyền lợi gói. savingPerMonthVnd âm nghĩa là gói đắt hơn trả theo lần.',
    ...(bookings.length === 0 &&
      classFees.length === 0 && {
        note: 'Người này chưa đặt sân hay đăng ký lớp trong 60 ngày qua: hỏi họ định tập gì, bao nhiêu buổi một tuần trước khi gợi ý.',
      }),
  };
};
