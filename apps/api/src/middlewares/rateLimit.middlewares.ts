import { rateLimit } from 'express-rate-limit';

import { ERROR_CODE } from '~/constants/errorCode';
import { HTTP_STATUS } from '~/constants/httpStatus';

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
    message: { status: false, code: ERROR_CODE.RATE_LIMITED, message },
  });

export const loginLimiter = limiter(
  15 * 60 * 1000,
  10,
  'Bạn đã đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút!',
);

export const otpLimiter = limiter(60 * 60 * 1000, 5, 'Bạn đã yêu cầu mã quá nhiều lần, vui lòng thử lại sau 1 giờ!');

export const authLimiter = limiter(15 * 60 * 1000, 30, 'Quá nhiều yêu cầu, vui lòng thử lại sau!');
