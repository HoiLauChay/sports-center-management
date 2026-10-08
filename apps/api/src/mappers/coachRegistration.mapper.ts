import type { CoachRegistration } from '@sports-center/shared';

import type { CoachRegistrationRow } from '~/repositories/coachRegistration.repository';

export const toCoachRegistrationResponse = (row: CoachRegistrationRow): CoachRegistration => ({
  id: row.id,
  classId: row.classId,
  coach: row.coach,
  status: row.status,
  source: row.source,
  createdAt: row.createdAt.toISOString(),
});
