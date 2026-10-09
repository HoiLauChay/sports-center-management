import type { SessionDetail } from '@sports-center/shared';

import { toSessionResponse } from '~/mappers/class.mapper';
import type { SessionDetailRow } from '~/repositories/session.repository';

export const toSessionDetailResponse = (row: SessionDetailRow): SessionDetail => ({
  ...toSessionResponse(row),
  class: {
    id: row.class.id,
    name: row.class.name,
    sport: row.class.course.sport,
    coach: row.class.coach,
    enrolledCount: row.class._count.enrollments,
    maxStudents: row.class.maxStudents,
  },
});
