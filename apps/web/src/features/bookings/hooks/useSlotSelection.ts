import type { FacilitySchedule } from '@sports-center/shared';
import { useState } from 'react';
import type { SlotSelection } from '../types';
import { isValidSelection } from '../utils/slot-selection';

/** The picked range, hidden while a refreshed schedule no longer allows it. */
export function useSlotSelection(schedules: Record<string, FacilitySchedule | undefined>) {
  const [selection, setSelection] = useState<SlotSelection | null>(null);
  const stale = Boolean(selection && schedules[selection.facilityId] && !isValidSelection(selection, schedules));
  return { selection: stale ? null : selection, invalidated: stale, onSelect: setSelection };
}
