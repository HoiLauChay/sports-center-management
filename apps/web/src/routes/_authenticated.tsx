import { createFileRoute, redirect } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';
import { AuthenticatedLayout } from '~/features/auth';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthReady && !context.auth.user) {
      throw redirect({ to: PATHS.login });
    }
  },
  component: AuthenticatedLayout,
});
