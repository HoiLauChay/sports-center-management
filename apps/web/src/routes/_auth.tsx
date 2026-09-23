import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthReady && context.auth.user) {
      throw redirect({ to: PATHS.app });
    }
  },
  component: Outlet,
});
