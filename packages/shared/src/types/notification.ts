import type { NotificationType } from '../constants/enums';
import type { CursorPaginated } from './api';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage extends CursorPaginated<AppNotification> {
  unreadCount: number;
}

export interface ListNotificationsQuery {
  unreadOnly?: boolean;
  cursor?: string;
  limit?: number;
}
