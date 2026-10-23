import type { Account } from '@sports-center/shared';
import { hashKey, type QueryClient } from '@tanstack/react-query';
import { PATHS } from '~/constants/paths';
import { sessionQueryOptions } from './session';

const CHANNEL_NAME = 'sports-center-session';

export function syncSessionAcrossTabs(queryClient: QueryClient) {
  if (typeof BroadcastChannel === 'undefined') return;

  const channel = new BroadcastChannel(CHANNEL_NAME);
  const sessionHash = hashKey(sessionQueryOptions.queryKey);
  let currentId: string | null | undefined;

  queryClient.getQueryCache().subscribe(({ query }) => {
    if (query.queryHash !== sessionHash) return;
    const user = query.state.data as Account | null | undefined;
    if (user === undefined) return;
    const id = user?.id ?? null;
    if (id === currentId) return;
    currentId = id;
    channel.postMessage(id);
  });

  channel.addEventListener('message', ({ data }: MessageEvent<string | null>) => {
    if (window.location.pathname === PATHS.activate) return;
    if (currentId !== undefined && data !== currentId) window.location.reload();
  });
}
