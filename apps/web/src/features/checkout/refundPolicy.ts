import type { Enrollment } from '~/features/classes/types';
import { todayVN } from '~/lib/time';

/** A member can leave a class until the day before it starts; after that there is no cancellation. */
export const canCancelEnrollment = (startDate: string | null) => startDate !== null && todayVN() < startDate;

/** Leaving a class before it starts gives back everything paid for that line. */
export const enrollmentRefund = (enrollment: Pick<Enrollment, 'paidAmount' | 'refundedAmount'>) =>
  enrollment.paidAmount - enrollment.refundedAmount;
