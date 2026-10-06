import type { FacilitySchedule, FacilitySlot } from '@sports-center/shared';
import type { SlotSelection } from '../types';

type Schedules = Record<string, FacilitySchedule | undefined>;

export const isSelectableSlot = (slot: FacilitySlot) => slot.status === 'AVAILABLE';

export function isValidSelection(
  selection: SlotSelection | null,
  schedules: Schedules,
  maxSlots = 3,
): selection is SlotSelection {
  if (
    !selection ||
    !Number.isInteger(selection.startIndex) ||
    !Number.isInteger(selection.count) ||
    selection.startIndex < 0 ||
    selection.count < 1 ||
    selection.count > maxSlots
  )
    return false;
  const slots = schedules[selection.facilityId]?.slots.slice(
    selection.startIndex,
    selection.startIndex + selection.count,
  );
  return Boolean(
    slots &&
    slots.length === selection.count &&
    slots.every(
      (slot, index) => isSelectableSlot(slot) && (index === 0 || slots[index - 1]?.endTime === slot.startTime),
    ),
  );
}

/** Extend only through consecutive, bookable time intervals; a different row starts a new range. */
export function selectSlot(
  schedules: Schedules,
  selection: SlotSelection | null,
  facilityId: string,
  index: number,
  maxSlots = 3,
): SlotSelection | null {
  const slot = schedules[facilityId]?.slots[index];
  if (!slot || !isSelectableSlot(slot)) return selection;
  if (isValidSelection(selection, schedules, maxSlots) && selection.facilityId === facilityId) {
    const end = selection.startIndex + selection.count;
    if (index === selection.startIndex && selection.count === 1) return null;
    if (index === end - 1 && selection.count > 1) return { ...selection, count: selection.count - 1 };
    if (index === selection.startIndex && selection.count > 1) {
      return { ...selection, startIndex: selection.startIndex + 1, count: selection.count - 1 };
    }
    if (index === end || index === selection.startIndex - 1) {
      const extended = { facilityId, startIndex: Math.min(index, selection.startIndex), count: selection.count + 1 };
      return isValidSelection(extended, schedules, maxSlots) ? extended : selection;
    }
    if (index > selection.startIndex && index < end) return selection;
  }
  const next = { facilityId, startIndex: index, count: 1 };
  return isValidSelection(next, schedules, maxSlots) ? next : null;
}
