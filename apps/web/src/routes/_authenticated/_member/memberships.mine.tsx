import { createFileRoute } from '@tanstack/react-router';
import { MyMembershipsPage } from '~/features/memberships';

export const Route = createFileRoute('/_authenticated/_member/memberships/mine')({
  component: MyMembershipsPage,
});
