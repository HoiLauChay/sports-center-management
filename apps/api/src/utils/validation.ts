import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

import { ERROR_CODE } from '~/constants/errorCode';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';

export const validate =
  (schema: z.ZodType<{ body?: unknown; query?: unknown; params?: unknown }>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const parsed = await schema.safeParseAsync({ body: req.body, query: req.query, params: req.params });

    if (!parsed.success) {
      return next(
        new ErrorWithStatus({
          message: 'Dữ liệu không hợp lệ!',
          status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
          code: ERROR_CODE.VALIDATION,
          errors: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        }),
      );
    }

    if (parsed.data.body !== undefined) req.body = parsed.data.body;
    next();
  };
