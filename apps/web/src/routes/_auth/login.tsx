import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '~/features/auth';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({ redirect: z.string().optional().catch(undefined) }),
  component: LoginPage,
});
