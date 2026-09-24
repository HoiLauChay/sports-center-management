import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODE } from '@sports-center/shared';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT_PREFIXES = ['/api/v1/payments/sepay/webhook', '/api/v1/cron/'];

const isSameOrigin = (origin: string, host: string | undefined) => {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};

export const sameOriginJsonWrites = (req: Request, _res: Response, next: NextFunction) => {
  if (!WRITE_METHODS.has(req.method) || EXEMPT_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    return next();
  }

  const origin = req.get('origin');
  if (origin && !isSameOrigin(origin, req.get('host'))) {
    return next(
      new ErrorWithStatus({
        message: 'Nguồn yêu cầu không hợp lệ',
        status: HTTP_STATUS.FORBIDDEN,
        code: ERROR_CODE.FORBIDDEN,
      }),
    );
  }

  const hasBody = req.get('transfer-encoding') !== undefined || Number(req.get('content-length') ?? 0) > 0;
  if (hasBody && !req.is('application/json')) {
    return next(
      new ErrorWithStatus({
        message: 'Chỉ chấp nhận dữ liệu JSON',
        status: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
        code: ERROR_CODE.UNSUPPORTED_MEDIA_TYPE,
      }),
    );
  }

  next();
};
