import { createFileRoute } from '@tanstack/react-router';
import { ManageMembershipsPage } from '~/features/memberships';

export const Route = createFileRoute('/_authenticated/_manager/admin/memberships')({
  component: ManageMembershipsPage,
});
