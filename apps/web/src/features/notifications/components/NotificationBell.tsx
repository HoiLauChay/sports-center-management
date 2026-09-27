import { Link, useNavigate } from '@tanstack/react-router';
import { Badge, Popover, Spin } from 'antd';
import { Bell } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '~/components/feedback/States';
import { PATHS } from '~/constants/paths';
import { useMarkAllRead, useNotificationSummary, useOpenNotification } from '../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const summary = useNotificationSummary();
  const markAllRead = useMarkAllRead();
  const openNotification = useOpenNotification();
  const unread = summary.data?.unreadCount ?? 0;
  const items = summary.data?.items ?? [];

  const content = (
    <div className="w-[min(360px,calc(100vw-32px))]">
      <div className="flex items-center justify-between border-b border-sc-border-soft px-4 py-3">
        <b>Thông báo</b>
        {unread > 0 && (
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-sc-primary"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {summary.isPending ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <div className="py-6">
            <EmptyState title="Chưa có thông báo" />
          </div>
        ) : (
          items.map((item) => (
            <NotificationItem
              key={item.id}
              notification={item}
              compact
              onOpen={(notification) => {
                setOpen(false);
                openNotification(notification);
              }}
            />
          ))
        )}
      </div>
      <div className="border-t border-sc-border-soft px-4 py-2.5 text-center">
        <Link to={PATHS.notifications} onClick={() => setOpen(false)} className="text-[13px] font-semibold">
          Xem tất cả thông báo
        </Link>
      </div>
    </div>
  );

  const bell = (
    <button
      type="button"
      className="relative inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-sc-border bg-white text-sc-ink-2 [transition:all_0.15s] hover:border-[#b9d3c5] hover:bg-sc-primary-soft hover:text-sc-primary"
      aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
      onClick={compact ? () => void navigate({ to: PATHS.notifications }) : undefined}
    >
      <Badge count={unread} size="small" overflowCount={99} offset={[4, -4]}>
        <Bell size={18} />
      </Badge>
    </button>
  );
  if (compact) return bell;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      content={content}
      styles={{ container: { padding: 0 } }}
    >
      {bell}
    </Popover>
  );
}
