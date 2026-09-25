import { createFileRoute, redirect } from '@tanstack/react-router';
import { PageLoading } from '~/components/feedback/States';
import { AuthenticatedErrorLayout } from '~/components/layouts/AuthenticatedErrorLayout';
import { MainLayout } from '~/components/layouts/MainLayout';
import { PATHS } from '~/constants/paths';
import { sessionQueryOptions } from '~/features/auth';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(sessionQueryOptions);
    if (!user) {
      throw redirect({ to: PATHS.login, search: { redirect: location.href } });
    }
    return { user };
  },
  pendingComponent: () => <PageLoading fullScreen />,
  component: MainLayout,
  errorComponent: AuthenticatedErrorLayout,
});
