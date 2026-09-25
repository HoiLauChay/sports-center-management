import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { PATHS } from '~/constants/paths';
import { sessionQueryOptions } from '~/features/auth';
import { safeRedirectPath } from '~/lib/access';

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.ensureQueryData(sessionQueryOptions).catch(() => null);
    if (user) {
      const target = safeRedirectPath((search as { redirect?: unknown }).redirect);
      throw redirect({ href: target ?? PATHS.dashboard });
    }
  },
  component: Outlet,
});
