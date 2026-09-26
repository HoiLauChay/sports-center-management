import { describe, expect, test } from 'bun:test';

import { allocate, percentOf, roundMoney } from '~/utils/money';

describe('roundMoney', () => {
  test('rounds half up to the nearest dong', () => {
    expect(roundMoney('10.5')).toBe(11);
    expect(roundMoney('10.49')).toBe(10);
    expect(percentOf(33_333, 15)).toBe(5000);
  });
});

describe('allocate', () => {
  test('always sums to the total and gives zero-weight parts nothing', () => {
    const cases: [number, number[]][] = [
      [100, [1, 1, 1]],
      [1, [1, 1, 1]],
      [999_999_999_999, [3, 7, 11, 13]],
      [50_000, [120_000, 0, 80_000]],
      [7, [0, 5, 0, 5]],
      [0, [0, 0]],
    ];

    for (const [total, weights] of cases) {
      const parts = allocate(total, weights);
      expect(parts.reduce((sum, part) => sum + part, 0)).toBe(total);
      expect(parts.filter((_, i) => weights[i] === 0).every((part) => part === 0)).toBe(true);
    }
  });

  test('gives leftover dong to the largest remainders, ties by order', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(10, [1, 2, 3])).toEqual([2, 3, 5]);
  });
});
