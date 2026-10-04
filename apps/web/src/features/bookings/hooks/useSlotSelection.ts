import { useState } from 'react';
import type { FacilitySchedule, SlotSelection } from '../types';
import { isValidSelection } from '../utils/slot-selection';

/** Discard an invalid range permanently so it cannot reappear when capacity becomes available again. */
export function useSlotSelection(schedules: Record<string, FacilitySchedule | undefined>) {
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const invalid = Boolean(selection && schedules[selection.facilityId] && !isValidSelection(selection, schedules));
  if (invalid) {
    setSelection(null);
    setInvalidated(true);
  }
  return {
    selection: invalid ? null : selection,
    invalidated: invalid || invalidated,
    onSelect: (next: SlotSelection | null) => {
      setSelection(next);
      setInvalidated(false);
    },
  };
}
