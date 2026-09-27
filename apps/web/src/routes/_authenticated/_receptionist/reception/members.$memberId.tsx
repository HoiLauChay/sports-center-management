import { createFileRoute } from '@tanstack/react-router';
import { MemberDetailPage } from '~/features/users';

export const Route = createFileRoute('/_authenticated/_receptionist/reception/members/$memberId')({
  component: MemberDetailPage,
});
