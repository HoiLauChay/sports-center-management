import type { Course as SharedCourse } from '@sports-center/shared';

export type Course = SharedCourse;

export interface CourseFilter {
  sportId?: string;
  q?: string;
}
