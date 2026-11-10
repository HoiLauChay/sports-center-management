import type { CoachPublicProfile } from '@sports-center/shared';

import type { CoachPublicRow } from '~/repositories/coach.repository';

export const toCoachPublicProfile = (row: CoachPublicRow): CoachPublicProfile => ({
  id: row.id,
  fullName: row.fullName,
  avatarUrl: row.avatarUrl,
  coverImageUrl: row.coverImageUrl,
  bio: row.coachProfile?.bio ?? null,
  experience: row.coachProfile?.experience ?? null,
  certifications: row.coachProfile?.certifications ?? null,
  sports: row.specializations.map(({ sport, experienceYears }) => ({ ...sport, experienceYears })),
});
