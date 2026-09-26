import { describe, expect, test } from 'bun:test';

import { PAGINATION } from '../constants/pagination';
import { cursorQuerySchema, pageQuerySchema } from './pagination';

describe('pageQuerySchema', () => {
  test('applies defaults when page and limit are missing', () => {
    expect(pageQuerySchema.parse({})).toEqual({ page: 1, limit: PAGINATION.DEFAULT_LIMIT });
  });

  test('coerces numeric strings from the query string', () => {
    expect(pageQuerySchema.parse({ page: '3', limit: '50' })).toEqual({ page: 3, limit: 50 });
  });

  test('rejects a limit above the maximum', () => {
    expect(pageQuerySchema.safeParse({ limit: String(PAGINATION.MAX_LIMIT + 1) }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: String(PAGINATION.MAX_LIMIT) }).success).toBe(true);
  });

  test('rejects non-positive, fractional and non-numeric values', () => {
    expect(pageQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ page: '1.5' }).success).toBe(false);
    expect(pageQuerySchema.safeParse({ limit: 'abc' }).success).toBe(false);
  });
});

describe('cursorQuerySchema', () => {
  test('accepts a missing cursor and applies the default limit', () => {
    expect(cursorQuerySchema.parse({})).toEqual({ limit: PAGINATION.DEFAULT_LIMIT });
  });

  test('accepts a uuid cursor and rejects anything else', () => {
    const cursor = '3f1c2b8e-4d5a-4b6c-9d7e-8f9a0b1c2d3e';
    expect(cursorQuerySchema.parse({ cursor, limit: '10' })).toEqual({ cursor, limit: 10 });
    expect(cursorQuerySchema.safeParse({ cursor: 'not-a-uuid' }).success).toBe(false);
  });
});
