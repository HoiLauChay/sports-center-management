import { GOOGLE_LOGIN_ERROR, type GoogleLoginErrorCode } from '@sports-center/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { LoginPage } from '~/features/auth';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(undefined),
    error: z
      .enum(Object.keys(GOOGLE_LOGIN_ERROR) as [GoogleLoginErrorCode, ...GoogleLoginErrorCode[]])
      .optional()
      .catch(undefined),
  }),
  component: LoginPage,
});
