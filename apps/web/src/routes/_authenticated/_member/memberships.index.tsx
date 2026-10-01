import { createFileRoute } from '@tanstack/react-router';
import { MembershipPlansPage } from '~/features/memberships';

export const Route = createFileRoute('/_authenticated/_member/memberships/')({
  component: MembershipPlansPage,
});
