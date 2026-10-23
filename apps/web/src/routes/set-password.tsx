import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';
import { PATHS } from '~/constants/paths';
import { FirstPasswordPage, sessionQueryOptions } from '~/features/auth';
import { safeRedirectPath } from '~/lib/access';

export const Route = createFileRoute('/set-password')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context, search }) => {
    const user = await context.queryClient.ensureQueryData(sessionQueryOptions).catch(() => null);
    if (!user) throw redirect({ to: PATHS.login });
    if (!user.mustSetPassword) throw redirect({ href: safeRedirectPath(search.redirect) ?? PATHS.dashboard });
  },
  component: FirstPasswordPage,
});
