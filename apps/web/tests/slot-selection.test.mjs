import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidSelection, selectSlot } from '../src/features/bookings/utils/slot-selection.ts';

const makeSchedules = (statuses = ['AVAILABLE', 'PARTIAL', 'AVAILABLE', 'AVAILABLE']) => ({
  court: {
    facility: { id: 'court', name: 'Sân', capacityPerSlot: 2 },
    date: '2026-10-05',
    slots: statuses.map((status, index) => ({
      startTime: `${String(8 + index).padStart(2, '0')}:00`,
      endTime: `${String(9 + index).padStart(2, '0')}:00`,
      status,
      booked: status === 'PARTIAL' ? 1 : 0,
      capacity: 2,
    })),
  },
});

test('FULL / CLASS / MAINTENANCE / CLOSED cannot be selected or included in a range', () => {
  for (const status of ['FULL', 'CLASS', 'MAINTENANCE', 'CLOSED']) {
    const schedules = makeSchedules(['AVAILABLE', status, 'AVAILABLE']);
    const selected = selectSlot(schedules, null, 'court', 0);
    assert.deepEqual(selectSlot(schedules, selected, 'court', 1), selected);
    assert.equal(selectSlot(schedules, null, 'court', 1), null);
    assert.equal(isValidSelection({ facilityId: 'court', startIndex: 0, count: 3 }, schedules), false);
  }
});

test('consecutive slots extend in either direction, stop at the limit, and shrink at either edge', () => {
  const schedules = makeSchedules();
  let selected = selectSlot(schedules, null, 'court', 1);
  selected = selectSlot(schedules, selected, 'court', 0);
  selected = selectSlot(schedules, selected, 'court', 2);
  assert.deepEqual(selected, { facilityId: 'court', startIndex: 0, count: 3 });
  assert.deepEqual(selectSlot(schedules, selected, 'court', 3), selected);
  assert.deepEqual(selectSlot(schedules, selected, 'court', 0), { facilityId: 'court', startIndex: 1, count: 2 });
  assert.deepEqual(selectSlot(schedules, selected, 'court', 2), { facilityId: 'court', startIndex: 0, count: 2 });
});

test('refresh invalidates a selection when a slot fills up', () => {
  const schedules = makeSchedules();
  const selected = { facilityId: 'court', startIndex: 0, count: 2 };
  assert.equal(isValidSelection(selected, schedules), true);
  schedules.court.slots[1].status = 'FULL';
  assert.equal(isValidSelection(selected, schedules), false);
});

test('adjacent indexes with a gap in time do not extend a range', () => {
  const schedules = makeSchedules();
  schedules.court.slots[1].startTime = '09:30';
  const selected = selectSlot(schedules, null, 'court', 0);
  assert.deepEqual(selectSlot(schedules, selected, 'court', 1), selected);
});

test('clicking a single selected slot deselects; a different facility or nonadjacent slot starts a new range', () => {
  const schedules = makeSchedules();
  schedules.other = { ...schedules.court, facility: { ...schedules.court.facility, id: 'other' } };
  const selected = selectSlot(schedules, null, 'court', 0);
  assert.equal(selectSlot(schedules, selected, 'court', 0), null);
  assert.deepEqual(selectSlot(schedules, selected, 'court', 3), { facilityId: 'court', startIndex: 3, count: 1 });
  assert.deepEqual(selectSlot(schedules, selected, 'other', 0), { facilityId: 'other', startIndex: 0, count: 1 });
});
