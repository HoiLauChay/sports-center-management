import { createFileRoute } from '@tanstack/react-router';
import { NotificationsPage } from '~/features/notifications';

export interface NotificationsSearch {
  unread?: boolean;
}

export const Route = createFileRoute('/_authenticated/notifications')({
  validateSearch: (search: Record<string, unknown>): NotificationsSearch => ({
    unread: search.unread === true || search.unread === 'true' ? true : undefined,
  }),
  component: NotificationsPage,
});
