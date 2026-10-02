import type { Course } from '@sports-center/shared';

import type { CourseRow } from '~/repositories/course.repository';

export const toCourseResponse = (course: CourseRow): Course => ({
  id: course.id,
  name: course.name,
  description: course.description,
  sport: {
    id: course.sport.id,
    name: course.sport.name,
  },
  totalSessions: course.totalSessions,
  price: Number(course.price),
  thumbnailUrl: course.thumbnailUrl,
});
