import type { Sport } from '@sports-center/shared';

import type { SportRow } from '~/repositories/sport.repository';

export const toSportResponse = (sport: SportRow): Sport => ({
  id: sport.id,
  name: sport.name,
  description: sport.description,
  iconUrl: sport.iconUrl,
  isActive: sport.isActive,
});
