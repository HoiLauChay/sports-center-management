import { createFileRoute } from '@tanstack/react-router';
import { ManagerSpecializationsPage } from '~/features/specializations';

export const Route = createFileRoute('/_authenticated/_manager/admin/specializations')({
  component: ManagerSpecializationsPage,
});
