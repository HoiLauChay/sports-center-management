import type { Specialization } from '@sports-center/shared';

import type { SpecializationRow } from '~/repositories/specialization.repository';

export const toSpecializationResponse = (row: SpecializationRow): Specialization => ({
  id: row.id,
  coach: { id: row.coachId, fullName: row.coach.fullName },
  sport: { id: row.sportId, name: row.sport.name },
  status: row.status,
  reviewNote: row.reviewNote,
  reviewedAt: row.reviewedAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
