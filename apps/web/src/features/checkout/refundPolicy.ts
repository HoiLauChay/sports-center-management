import type { SystemSettings } from '@sports-center/shared';
import type { Booking, Refund } from '~/features/bookings/types';
import type { Enrollment } from '~/features/classes/types';
import { formatVND } from '~/lib/format';
import { DATE_FORMAT, nowVN, parseDate, todayVN } from '~/lib/time';

/** BR_2.6: full refund of what was paid when cancelling at least N hours before the slot starts; guests never. */
export function bookingRefund(
  booking: Pick<Booking, 'date' | 'startTime' | 'paidAmount' | 'refundedAmount' | 'account'>,
  settings: Pick<SystemSettings, 'bookingCancelDeadlineHours'>,
): Refund {
  if (!booking.account) return { amount: 0, reason: 'GUEST' };
  const refundable = booking.paidAmount - booking.refundedAmount;
  if (refundable <= 0) return { amount: 0, reason: 'FREE_ITEM' };
  const hoursLeft = parseDate(booking.date)
    .hour(Number(booking.startTime.slice(0, 2)))
    .minute(Number(booking.startTime.slice(3, 5)))
    .diff(nowVN().format(`${DATE_FORMAT} HH:mm`), 'hour', true);
  return hoursLeft >= settings.bookingCancelDeadlineHours
    ? { amount: refundable, reason: 'FULL' }
    : { amount: 0, reason: 'PAST_DEADLINE' };
}

/** BR_2.7: full refund when cancelling at least N days before the first session. */
export function enrollmentRefund(
  enrollment: Pick<Enrollment, 'paidAmount' | 'refundedAmount'>,
  firstSessionDate: string | null,
  settings: Pick<SystemSettings, 'courseCancelDeadlineDays'>,
): Refund {
  const refundable = enrollment.paidAmount - enrollment.refundedAmount;
  if (refundable <= 0) return { amount: 0, reason: 'FREE_ITEM' };
  const daysLeft = firstSessionDate ? parseDate(firstSessionDate).diff(parseDate(todayVN()), 'day') : -1;
  return daysLeft >= settings.courseCancelDeadlineDays
    ? { amount: refundable, reason: 'FULL' }
    : { amount: 0, reason: 'PAST_DEADLINE' };
}

/** The sentence shown in cancel confirmations: says exactly how much is (not) refunded and why. */
export function describeRefund(refund: Refund, settings: SystemSettings, kind: 'booking' | 'enrollment'): string {
  switch (refund.reason) {
    case 'FULL':
      return `Bạn sẽ được hoàn ${formatVND(refund.amount)} về ví.`;
    case 'PAST_DEADLINE':
      return kind === 'booking'
        ? `Đã quá hạn hủy (phải hủy trước giờ bắt đầu ít nhất ${settings.bookingCancelDeadlineHours} giờ), nên sẽ KHÔNG được hoàn tiền.`
        : `Đã quá hạn hủy (phải hủy trước buổi học đầu tiên ít nhất ${settings.courseCancelDeadlineDays} ngày), nên sẽ KHÔNG được hoàn tiền.`;
    case 'FREE_ITEM':
      return 'Dịch vụ này không có khoản thanh toán nên không có tiền hoàn.';
    case 'GUEST':
      return 'Khách vãng lai không được hoàn tiền.';
  }
}
