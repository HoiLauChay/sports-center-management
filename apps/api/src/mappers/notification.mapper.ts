import type { AppNotification } from '@sports-center/shared';

import type { NotificationRow } from '~/repositories/notification.repository';

export const toNotificationResponse = (notification: NotificationRow): AppNotification => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  referenceType: notification.referenceType,
  referenceId: notification.referenceId,
  readAt: notification.readAt?.toISOString() ?? null,
  createdAt: notification.createdAt.toISOString(),
});
