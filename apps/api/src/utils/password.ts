import bcrypt from 'bcryptjs';

import { AUTH } from '~/constants/auth';

export const hashPassword = (password: string) => bcrypt.hash(password, AUTH.BCRYPT_ROUNDS);

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
