import { createFileRoute } from '@tanstack/react-router';
import { ClassAdminDetailPage } from '~/features/classes';

export const Route = createFileRoute('/_authenticated/_manager/admin/classes/$classId')({
  component: ClassAdminDetailPage,
});
