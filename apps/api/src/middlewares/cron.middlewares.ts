import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODE } from '@sports-center/shared';
import { env } from '~/configs/env';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';
import { safeEqual } from '~/utils/token';

export const cronAuth = (req: Request, _res: Response, next: NextFunction) => {
  const header = req.get('authorization') ?? '';
  if (!env.CRON_SECRET || !safeEqual(header, `Bearer ${env.CRON_SECRET}`)) {
    return next(
      new ErrorWithStatus({
        message: 'Không có quyền',
        status: HTTP_STATUS.UNAUTHORIZED,
        code: ERROR_CODE.UNAUTHORIZED,
      }),
    );
  }
  next();
};
