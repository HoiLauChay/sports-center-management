import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';
import { safeRedirectPath } from '~/lib/access';

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthReady && context.auth.user) {
      const target = safeRedirectPath((search as { redirect?: unknown }).redirect);
      throw redirect({ href: target ?? PATHS.dashboard });
    }
  },
  component: Outlet,
});
