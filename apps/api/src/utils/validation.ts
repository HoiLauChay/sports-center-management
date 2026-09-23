import { ERROR_CODE, type ApiFieldError } from '@sports-center/shared';
import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';

interface RequestSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

const TARGETS = ['body', 'query', 'params'] as const;

export const validate = (schemas: RequestSchemas) => async (req: Request, _res: Response, next: NextFunction) => {
  const errors: ApiFieldError[] = [];

  for (const target of TARGETS) {
    const schema = schemas[target];
    if (!schema) continue;

    const parsed = await schema.safeParseAsync(req[target]);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push({ path: [target, ...issue.path].join('.'), message: issue.message });
      }
    } else if (target === 'body') {
      req.body = parsed.data;
    }
  }

  if (errors.length > 0) {
    return next(
      new ErrorWithStatus({
        message: 'Dữ liệu không hợp lệ',
        status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
        code: ERROR_CODE.VALIDATION,
        errors,
      }),
    );
  }

  next();
};
