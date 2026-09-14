import type { CookieOptions, Response } from 'express';

import { isProduction } from '~/configs/env';
import { AUTH, COOKIE } from '~/constants/auth';

const base: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie(COOKIE.ACCESS_TOKEN, accessToken, { ...base, maxAge: AUTH.ACCESS_TOKEN_TTL * 1000 });
  res.cookie(COOKIE.REFRESH_TOKEN, refreshToken, {
    ...base,
    path: COOKIE.REFRESH_PATH,
    maxAge: AUTH.REFRESH_TOKEN_TTL * 1000,
  });
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(COOKIE.ACCESS_TOKEN, base);
  res.clearCookie(COOKIE.REFRESH_TOKEN, { ...base, path: COOKIE.REFRESH_PATH });
};
