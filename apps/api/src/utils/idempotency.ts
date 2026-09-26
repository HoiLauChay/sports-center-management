import { createHash } from 'node:crypto';

import { ERROR_CODE } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';
import { isUniqueViolation } from '~/utils/dbError';

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

export const idempotencyKey = {
  checkout: (accountId: string, clientKey: string) => `checkout:${accountId}:${clientKey}`,
  counter: (receptionistId: string, clientKey: string) => `counter:${receptionistId}:${clientKey}`,
  renew: (membershipId: string, periodStart: Date) => `renew:${membershipId}:${toDateKey(periodStart)}`,
  payment: (orderId: string) => `payment:${orderId}`,
  sepay: (bankTransactionId: string) => `sepay:${bankTransactionId}`,
  cash: (receptionistId: string, clientKey: string) => `cash:${receptionistId}:${clientKey}`,
  refundBooking: (bookingId: string) => `refund:booking:${bookingId}`,
  refundSession: (sessionId: string, enrollmentId: string) => `refund:session:${sessionId}:${enrollmentId}`,
  refundEnrollment: (enrollmentId: string) => `refund:enrollment:${enrollmentId}`,
};

export const hashRequest = (payload: unknown) => createHash('sha256').update(JSON.stringify(payload)).digest('hex');

interface IdempotentOperation<T extends { requestHash: string | null }> {
  requestHash: string | null;
  find: () => Promise<T | null>;
  execute: () => Promise<T>;
}

export const withIdempotency = async <T extends { requestHash: string | null }>({
  requestHash,
  find,
  execute,
}: IdempotentOperation<T>) => {
  const replay = async () => {
    const existing = await find();
    if (existing && existing.requestHash !== requestHash) {
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
    if (!isUniqueViolation(err, '_idempotency_key_key')) throw err;
    const stored = await replay();
    if (!stored) throw err;
    return stored;
  }
};
