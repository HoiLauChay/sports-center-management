import { randomInt } from 'node:crypto';

import { isUniqueViolation } from '~/utils/dbError';
import { todayInCenter } from '~/utils/time';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAYMENT_CODE_PATTERN = /HLC[A-Z0-9]{8}/;
const MAX_ATTEMPTS = 3;

const randomCode = (length: number) => Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

const centerDateStamp = (now: Date) => todayInCenter(now).replaceAll('-', '').slice(2);

export const paymentCode = {
  generate: () => `HLC${randomCode(8)}`,
};

export const orderNumber = {
  generate: (now = new Date()) => `DH${centerDateStamp(now)}${randomCode(6)}`,
};

export const transactionCode = {
  generate: (now = new Date()) => `GD${centerDateStamp(now)}${randomCode(8)}`,
};

export const extractPaymentCode = (content: string) => content.toUpperCase().match(PAYMENT_CODE_PATTERN)?.[0] ?? null;

export const retryOnDuplicateCode = async <T>(indexSuffix: string, run: () => Promise<T>) => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isUniqueViolation(err, indexSuffix)) throw err;
    }
  }
};
