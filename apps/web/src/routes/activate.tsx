import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ActivatePage, endSessionHere, sessionQueryOptions } from '~/features/auth';

export const Route = createFileRoute('/activate')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(sessionQueryOptions).catch(() => null);
    if (user) await endSessionHere(context.queryClient);
  },
  component: ActivatePage,
});
