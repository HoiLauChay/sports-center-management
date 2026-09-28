import type { FacilityType } from '../constants/enums';
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
