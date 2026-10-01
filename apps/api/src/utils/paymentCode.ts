import { randomInt } from 'node:crypto';

import { isUniqueViolation } from '~/utils/dbError';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_ATTEMPTS = 3;

const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

export const paymentCode = {
  generate: () => `HLC${randomCode(8)}`,
};

export const retryOnDuplicateCode = async <T>(indexSuffix: string, run: () => Promise<T>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isUniqueViolation(err, indexSuffix)) throw err;
    }
  }
};
