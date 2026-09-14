import jwt from 'jsonwebtoken';

import { env } from '~/configs/env';
import { AUTH } from '~/constants/auth';
import type { Role } from '~/generated/prisma/client';

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  iat: number;
  exp: number;
}

export const signAccessToken = (userId: string, role: Role) =>
  jwt.sign({ role }, env.JWT_SECRET, { subject: userId, expiresIn: AUTH.ACCESS_TOKEN_TTL, algorithm: 'HS256' });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as AccessTokenPayload;
