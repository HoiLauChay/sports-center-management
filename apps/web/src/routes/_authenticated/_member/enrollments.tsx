import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/_member/enrollments')({
  beforeLoad: () => {
    throw redirect({ to: '/training', replace: true });
  },
});
