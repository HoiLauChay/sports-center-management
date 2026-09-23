import { AUTH_RULES } from '@sports-center/shared';

export const AUTH = {
  ...AUTH_RULES,
  ACCESS_TOKEN_TTL: 15 * 60,
  REFRESH_TOKEN_TTL: 30 * 24 * 60 * 60,
  OTP_TTL: 10 * 60,
  OTP_MAX_ATTEMPTS: 5,
  BCRYPT_ROUNDS: 12,
} as const;

export const COOKIE = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  REFRESH_PATH: '/api/v1/auth',
} as const;
