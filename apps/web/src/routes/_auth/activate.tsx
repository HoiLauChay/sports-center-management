import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ActivatePage } from '~/features/auth';

export const Route = createFileRoute('/_auth/activate')({
  validateSearch: z.object({ token: z.string().optional().catch(undefined) }),
  component: ActivatePage,
});
