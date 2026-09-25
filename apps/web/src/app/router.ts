import { createRouter } from '@tanstack/react-router';
import { sessionQueryOptions } from '~/features/auth';
import { configureHttpAuthRefreshFailed } from '~/lib/http';
import { routeTree } from '../routeTree.gen';
import { queryClient } from './queryClient';

export const router = createRouter({
  routeTree,
  context: { queryClient },
});

configureHttpAuthRefreshFailed(() => {
  if (!queryClient.getQueryData(sessionQueryOptions.queryKey)) return;
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'auth' });
  queryClient.setQueryData(sessionQueryOptions.queryKey, null);
  void router.invalidate();
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
