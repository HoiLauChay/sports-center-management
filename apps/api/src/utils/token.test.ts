import { describe, expect, test } from 'bun:test';

import { AUTH } from '~/constants/auth';
import { generateOtp, hashToken, safeEqual } from '~/utils/token';

describe('generateOtp', () => {
  test('returns a numeric code with the configured length', () => {
    const pattern = new RegExp(`^\\d{${AUTH.OTP_LENGTH}}$`);
    for (let i = 0; i < 100; i++) expect(generateOtp()).toMatch(pattern);
  });
});

describe('hashToken', () => {
  test('is deterministic and never returns the raw value', () => {
    expect(hashToken('secret-token')).toBe(hashToken('secret-token'));
    expect(hashToken('secret-token')).not.toBe('secret-token');
    expect(hashToken('secret-token')).not.toBe(hashToken('other-token'));
  });
});

describe('safeEqual', () => {
  test('compares strings of equal and different length', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
