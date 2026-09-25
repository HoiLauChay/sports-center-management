import { ERROR_CODE } from '@sports-center/shared';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import type { NextFunction, Request, Response } from 'express';

import { redis } from '~/configs/redis';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';
import { getClientIp } from '~/utils/request';

const REDIS_TIMEOUT_MS = 1000;

const createLimiter = (name: string, requests: number, window: Duration) =>
  redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window),
        prefix: `rl:${name}`,
        timeout: REDIS_TIMEOUT_MS,
      })
    : null;

const rateLimit = (limiter: Ratelimit | null) => async (req: Request, _res: Response, next: NextFunction) => {
  if (!limiter) return next();

  try {
    const { success, reset } = await limiter.limit(getClientIp(req) ?? 'unknown');
    if (success) return next();

    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    next(
      new ErrorWithStatus({
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
        code: ERROR_CODE.RATE_LIMITED,
        message: `Bạn thao tác quá nhanh, vui lòng thử lại sau ${retryAfter} giây`,
        meta: { retryAfter },
      }),
    );
  } catch (err) {
    console.error('Rate limit check failed:', err);
    next();
  }
};

export const sendOtpLimit = rateLimit(createLimiter('auth:send-otp', 5, '1 h'));
export const loginLimit = rateLimit(createLimiter('auth:login', 10, '15 m'));
export const registerLimit = rateLimit(createLimiter('auth:register', 30, '15 m'));
export const resetPasswordLimit = rateLimit(createLimiter('auth:reset-password', 30, '15 m'));
export const refreshLimit = rateLimit(createLimiter('auth:refresh', 120, '15 m'));
