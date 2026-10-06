import { List, Tag } from 'antd';
import type { ReactNode } from 'react';
import { EmptyState } from '~/components/feedback/States';
import type { CalendarEvent } from '~/features/schedule/types';
import { KIND_STYLE } from '~/features/schedule/utils';
import { formatDayLabel } from '~/lib/time';

interface UpcomingListProps {
  events: CalendarEvent[];
  loading?: boolean;
  empty: ReactNode;
  action?: (event: CalendarEvent) => ReactNode;
}

/** The next few bookings / sessions as a compact list, shared by the member and coach dashboards. */
export function UpcomingList({ events, loading, empty, action }: UpcomingListProps) {
  return (
    <List
      loading={loading}
      dataSource={events}
      locale={{ emptyText: <EmptyState title="Chưa có lịch sắp tới" action={empty} /> }}
      renderItem={(event) => (
        <List.Item actions={action ? [action(event)] : undefined}>
          <div className="flex min-w-0 items-center gap-3">
            <span className={`h-9 w-1 shrink-0 rounded ${KIND_STYLE[event.kind].dot}`} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{event.title}</span>
              <span className="text-[13px] text-sc-muted">
                {formatDayLabel(event.date)} · {event.startTime}–{event.endTime}
                {event.subtitle ? ` · ${event.subtitle}` : ''}
              </span>
            </div>
            <Tag className="!m-0 !ml-auto shrink-0">{KIND_STYLE[event.kind].label}</Tag>
          </div>
        </List.Item>
      )}
    />
  );
}
