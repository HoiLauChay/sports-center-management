import { createFileRoute } from '@tanstack/react-router';
import { ClassesAdminPage } from '~/features/classes';
import { parseStringSearch } from '~/lib/search';

export const Route = createFileRoute('/_authenticated/_manager/admin/classes/')({
  validateSearch: (search: Record<string, unknown>): { courseId?: string } => ({
    courseId: parseStringSearch(search.courseId),
  }),
  component: ClassesAdminPage,
});
