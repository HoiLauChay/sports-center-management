import type { AppNotification, NotificationPage } from '@sports-center/shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { App } from 'antd';
import { useMemo } from 'react';
import { toApiError } from '~/lib/http-errors';
import { notificationsService } from '../services/notifications.service';
import { notificationTarget } from '../utils/notificationTarget';

const PAGE_SIZE = 20;
const PREVIEW_SIZE = 5;
const POLL_INTERVAL = 60_000;
const ERROR_POLL_INTERVAL = 5 * 60_000;

export const notificationKeys = {
  all: ['notifications'] as const,
  summary: ['notifications', 'summary'] as const,
  feed: (unreadOnly: boolean) => ['notifications', 'feed', { unreadOnly }] as const,
};

export function useNotificationSummary() {
  return useQuery({
    queryKey: notificationKeys.summary,
    queryFn: () => notificationsService.list({ limit: PREVIEW_SIZE }),
    refetchInterval: (query) => (query.state.status === 'error' ? ERROR_POLL_INTERVAL : POLL_INTERVAL),
  });
}

export function useNotificationFeed(unreadOnly: boolean) {
  const query = useInfiniteQuery({
    queryKey: notificationKeys.feed(unreadOnly),
    queryFn: ({ pageParam }) =>
      notificationsService.list({ unreadOnly: unreadOnly || undefined, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = useMemo(() => {
    const byId = new Map<string, AppNotification>();
    for (const page of query.data?.pages ?? []) {
      for (const item of page.items) if (!byId.has(item.id)) byId.set(item.id, item);
    }
    return [...byId.values()];
  }, [query.data]);

  return { ...query, items };
}

type Patch = (item: AppNotification) => AppNotification;

function patchCaches(queryClient: QueryClient, patch: Patch, unreadCount: (count: number) => number) {
  const patchPage = (page: NotificationPage): NotificationPage => ({
    ...page,
    items: page.items.map(patch),
    unreadCount: unreadCount(page.unreadCount),
  });
  queryClient.setQueryData<NotificationPage>(notificationKeys.summary, (data) => data && patchPage(data));
  queryClient.setQueriesData<InfiniteData<NotificationPage>>(
    { queryKey: ['notifications', 'feed'] },
    (data) => data && { ...data, pages: data.pages.map(patchPage) },
  );
}

export function useMarkAllRead() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: notificationsService.markAllRead,
    onSuccess: () => {
      const now = new Date().toISOString();
      patchCaches(
        queryClient,
        (item) => (item.readAt ? item : { ...item, readAt: now }),
        () => 0,
      );
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (err) => message.error(toApiError(err).message),
  });
}

export function useOpenNotification() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const markRead = useMutation({
    mutationFn: notificationsService.markRead,
    onMutate: (id) => {
      const now = new Date().toISOString();
      patchCaches(
        queryClient,
        (item) => (item.id === id && !item.readAt ? { ...item, readAt: now } : item),
        (count) => Math.max(0, count - 1),
      );
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });

  return (notification: AppNotification) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    const target = notificationTarget(notification);
    if (target) void navigate(target);
  };
}
