import { createFileRoute } from '@tanstack/react-router';
import { ClassesAdminPage } from '~/features/classes';

export const Route = createFileRoute('/_authenticated/_manager/admin/classes/')({
  component: ClassesAdminPage,
});
