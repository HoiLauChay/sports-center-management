import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { NotFoundPage } from '~/components/feedback/RouteStatus';
import type { AuthContextValue } from '~/features/auth';

export interface RouterContext {
  auth: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <NotFoundPage />
    </div>
  ),
});
