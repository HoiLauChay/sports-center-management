import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { env } from '~/configs/env';
import { AUTH } from '~/constants/auth';

export const generateOpaqueToken = () => randomBytes(48).toString('base64url');

export const generateOtp = () =>
  randomInt(0, 10 ** AUTH.OTP_LENGTH)
    .toString()
    .padStart(AUTH.OTP_LENGTH, '0');

export const hashToken = (value: string) => createHmac('sha256', env.TOKEN_HASH_SECRET).update(value).digest('hex');

export const safeEqual = (a: string, b: string) => {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
};
