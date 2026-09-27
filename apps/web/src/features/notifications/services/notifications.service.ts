import type { ApiResponse, ListNotificationsQuery, NotificationPage } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const notificationsService = {
  list: async (params: ListNotificationsQuery) => {
    const { data } = await privateApi.get<ApiResponse<NotificationPage>>('/me/notifications', { params });
    return data.result;
  },

  markRead: async (id: string) => {
    await privateApi.patch(`/me/notifications/${encodeURIComponent(id)}/read`);
  },

  markAllRead: async () => {
    await privateApi.post('/me/notifications/read-all');
  },
};
