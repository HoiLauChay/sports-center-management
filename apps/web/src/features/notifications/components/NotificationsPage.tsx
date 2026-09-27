import { getRouteApi } from '@tanstack/react-router';
import { Button, Card, Segmented, Spin } from 'antd';
import { CheckCheck } from 'lucide-react';
import { EmptyState, ErrorState } from '~/components/feedback/States';
import { PageHeader } from '~/components/ui/PageHeader';
import { toApiError } from '~/lib/http-errors';
import {
  useMarkAllRead,
  useNotificationFeed,
  useNotificationSummary,
  useOpenNotification,
} from '../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

const routeApi = getRouteApi('/_authenticated/notifications');

export function NotificationsPage() {
  const { unread: unreadOnly = false } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const feed = useNotificationFeed(unreadOnly);
  const unreadCount = useNotificationSummary().data?.unreadCount ?? 0;
  const markAllRead = useMarkAllRead();
  const openNotification = useOpenNotification();

  return (
    <>
      <PageHeader
        title="Thông báo"
        description={unreadCount > 0 ? `Bạn có ${unreadCount} thông báo chưa đọc.` : 'Bạn đã đọc hết thông báo.'}
        extra={
          <Button
            icon={<CheckCheck size={16} />}
            disabled={unreadCount === 0}
            loading={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      <Card styles={{ body: { padding: 0 } }}>
        <div className="border-b border-sc-border-soft px-4 py-3">
          <Segmented
            value={unreadOnly ? 'unread' : 'all'}
            onChange={(value) => void navigate({ search: { unread: value === 'unread' || undefined }, replace: true })}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'unread', label: `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            ]}
          />
        </div>

        {feed.isPending ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : feed.isError && feed.items.length === 0 ? (
          <ErrorState message={toApiError(feed.error).message} onRetry={() => void feed.refetch()} />
        ) : feed.items.length === 0 ? (
          <div className="py-10">
            <EmptyState title={unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'} />
          </div>
        ) : (
          <>
            {feed.items.map((item) => (
              <NotificationItem key={item.id} notification={item} onOpen={openNotification} />
            ))}
            {feed.hasNextPage && (
              <div className="border-t border-sc-border-soft p-3 text-center">
                <Button loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                  Tải thêm
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
