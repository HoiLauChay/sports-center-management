import { describe, expect, test } from 'bun:test';

import { generateSlots, isOnSlotGrid, overlaps, parseTime, toCenterDateTime, todayInCenter } from '~/utils/time';

describe('center timezone', () => {
  test('uses the Vietnam date late in the UTC evening', () => {
    expect(todayInCenter(new Date('2026-03-01T23:30:00Z'))).toBe('2026-03-02');
    expect(toCenterDateTime('2026-03-02', parseTime('06:30')).toISOString()).toBe('2026-03-01T23:30:00.000Z');
  });
});

describe('intervals and slot grid', () => {
  test('treats adjacent intervals as non-overlapping', () => {
    expect(overlaps({ start: 60, end: 120 }, { start: 120, end: 180 })).toBe(false);
    expect(overlaps({ start: 60, end: 121 }, { start: 120, end: 180 })).toBe(true);
  });

  test('builds the slot grid and accepts only aligned ranges', () => {
    const [open, close] = [parseTime('06:00'), parseTime('09:30')];

    expect(generateSlots(open, close, 60).map(({ start }) => start)).toEqual([360, 420, 480]);
    expect(isOnSlotGrid({ start: 420, end: 540 }, open, close, 60)).toBe(true);
    expect(isOnSlotGrid({ start: 450, end: 510 }, open, close, 60)).toBe(false);
    expect(isOnSlotGrid({ start: 480, end: 600 }, open, close, 60)).toBe(false);
  });
});
