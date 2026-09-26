import { describe, expect, test } from 'bun:test';

import { AUTH_RULES } from '../constants/auth';
import { emailSchema, otpSchema, passwordSchema } from './auth';

describe('emailSchema', () => {
  test('trims and lowercases the email', () => {
    expect(emailSchema.parse('  Member@Example.COM ')).toBe('member@example.com');
  });

  test('rejects empty and malformed emails', () => {
    expect(emailSchema.safeParse('').success).toBe(false);
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('passwordSchema', () => {
  test('requires letters and digits within the length limits', () => {
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefgh').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('a1').success).toBe(false);
    expect(passwordSchema.safeParse(`a1${'x'.repeat(AUTH_RULES.PASSWORD_MAX_LENGTH)}`).success).toBe(false);
  });
});

describe('otpSchema', () => {
  test('accepts only digits with the configured length', () => {
    expect(otpSchema.safeParse('0'.repeat(AUTH_RULES.OTP_LENGTH)).success).toBe(true);
    expect(otpSchema.safeParse('12a456').success).toBe(false);
    expect(otpSchema.safeParse('1'.repeat(AUTH_RULES.OTP_LENGTH - 1)).success).toBe(false);
  });
});
