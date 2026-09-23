import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { ERROR_CODE, type ErrorCode } from '@sports-center/shared';
import { COOKIE } from '~/constants/auth';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Role } from '~/generated/prisma/client';
import userRepository from '~/repositories/user.repository';
import { ErrorWithStatus } from '~/rules/error';
import { verifyAccessToken, type AccessTokenPayload } from '~/utils/jwt';

const unauthorized = (message: string, code: ErrorCode) =>
  new ErrorWithStatus({ message, status: HTTP_STATUS.UNAUTHORIZED, code });

export const auth = async (req: Request, _res: Response, next: NextFunction) => {
  const token: unknown = req.cookies?.[COOKIE.ACCESS_TOKEN];
  if (typeof token !== 'string' || !token) {
    return next(unauthorized('Token không được cung cấp', ERROR_CODE.UNAUTHORIZED));
  }

  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(unauthorized('Token đã hết hạn', ERROR_CODE.TOKEN_EXPIRED));
    }
    return next(unauthorized('Token không hợp lệ', ERROR_CODE.TOKEN_INVALID));
  }

  const user = await userRepository.findAuthStateById(payload.sub);
  if (!user || user.status !== 'ACTIVE') {
    return next(unauthorized('Tài khoản không hợp lệ', ERROR_CODE.UNAUTHORIZED));
  }

  if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime()) {
    return next(unauthorized('Token đã hết hạn', ERROR_CODE.TOKEN_EXPIRED));
  }

  req.user = { id: user.id, role: user.role };
  next();
};

export const isRole = (roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(
      new ErrorWithStatus({
        message: 'Bạn không có quyền truy cập',
        status: HTTP_STATUS.FORBIDDEN,
        code: ERROR_CODE.FORBIDDEN,
      }),
    );
  }
  next();
};
