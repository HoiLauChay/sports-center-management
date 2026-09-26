import { ERROR_CODE } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';
import { isUniqueViolation } from '~/utils/dbError';

export const idempotencyKey = {
  checkout: (accountId: string, clientKey: string) => `checkout:${accountId}:${clientKey}`,
  counter: (receptionistId: string, clientKey: string) => `counter:${receptionistId}:${clientKey}`,
  renew: (membershipId: string, periodStart: string) => `renew:${membershipId}:${periodStart}`,
  payment: (orderId: string) => `payment:${orderId}`,
  sepay: (bankTransactionId: string) => `sepay:${bankTransactionId}`,
  cash: (receptionistId: string, clientKey: string) => `cash:${receptionistId}:${clientKey}`,
  refundBooking: (bookingId: string) => `refund:booking:${bookingId}`,
  refundSession: (sessionId: string, enrollmentId: string) => `refund:session:${sessionId}:${enrollmentId}`,
  refundEnrollment: (enrollmentId: string) => `refund:enrollment:${enrollmentId}`,
};

interface IdempotentOperation<T> {
  find: () => Promise<T | null>;
  matches: (existing: T) => boolean;
  execute: () => Promise<T>;
}

const isIdempotencyKeyViolation = (err: unknown) =>
  isUniqueViolation(err, (index) => index.endsWith('_idempotency_key_key'));

export const withIdempotency = async <T>({ find, matches, execute }: IdempotentOperation<T>) => {
  const replay = async () => {
    const existing = await find();
    if (existing && !matches(existing)) {
      throw new ErrorWithStatus({
        message: 'Yêu cầu đã được xử lý với nội dung khác',
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.IDEMPOTENCY_CONFLICT,
      });
    }
    return existing;
  };

  const existing = await replay();
  if (existing) return existing;

  try {
    return await execute();
  } catch (err) {
    if (!isIdempotencyKeyViolation(err)) throw err;
    const stored = await replay();
    if (!stored) throw err;
    return stored;
  }
};
