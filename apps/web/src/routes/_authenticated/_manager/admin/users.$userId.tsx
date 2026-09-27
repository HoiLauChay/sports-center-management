import { createFileRoute } from '@tanstack/react-router';
import { AdminUserDetailPage } from '~/features/users';

export const Route = createFileRoute('/_authenticated/_manager/admin/users/$userId')({
  component: AdminUserDetailPage,
});
