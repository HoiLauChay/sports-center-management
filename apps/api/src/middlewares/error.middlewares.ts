import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODE } from '@sports-center/shared';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';

export const notFoundHandler = (_req: Request, res: Response) => {
  res
    .status(HTTP_STATUS.NOT_FOUND)
    .json({ status: false, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy tài nguyên' });
};

export const defaultErrorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ErrorWithStatus) {
    const { status, code, message, errors, meta } = err;
    res.status(status).json({ status: false, code, message, ...meta, ...(errors !== undefined && { errors }) });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    status: false,
    code: ERROR_CODE.INTERNAL,
    message: 'Lỗi hệ thống',
  });
};
