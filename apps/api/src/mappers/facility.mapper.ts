import type { Facility } from '@sports-center/shared';

import type { FacilityRow } from '~/repositories/facility.repository';
import { roundMoney } from '~/utils/money';

export const toFacilityResponse = (facility: FacilityRow): Facility => ({
  id: facility.id,
  name: facility.name,
  type: facility.type,
  description: facility.description,
  capacityPerSlot: facility.capacityPerSlot,
  pricePerSlot: roundMoney(facility.pricePerSlot),
  isActive: facility.isActive,
  sports: facility.sports.map(({ sport }) => sport),
});
