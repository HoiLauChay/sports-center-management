import type { FacilitySlotStatus, FacilityType } from '../constants/enums';
import type { Ref } from './api';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  description: string | null;
  capacityPerSlot: number;
  pricePerSlot: number;
  isActive: boolean;
  sports: Ref[];
}

export interface FacilitySlot {
  startTime: string;
  endTime: string;
  status: FacilitySlotStatus;
  booked: number;
  capacity: number;
  classSession?: { classId: string; className: string };
  maintenance?: { id: string; reason: string };
}

export interface FacilitySchedule {
  facility: { id: string; name: string; capacityPerSlot: number };
  date: string;
  slots: FacilitySlot[];
}
