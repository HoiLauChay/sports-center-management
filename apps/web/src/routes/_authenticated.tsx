import { createFileRoute, redirect } from '@tanstack/react-router';
import { RouteErrorPage } from '~/components/feedback/RouteStatus';
import { MainLayout } from '~/components/layouts/MainLayout';
import { PATHS } from '~/constants/paths';
import { canAccess, ForbiddenError } from '~/lib/access';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    const { isAuthReady, user } = context.auth;
    if (!isAuthReady) return;
    if (!user) {
      throw redirect({ to: PATHS.login, search: { redirect: location.href } });
    }
    if (!canAccess(user.role, location.pathname)) {
      throw new ForbiddenError();
    }
  },
  component: MainLayout,
  errorComponent: (props) => (
    <MainLayout>
      <RouteErrorPage {...props} />
    </MainLayout>
  ),
});
