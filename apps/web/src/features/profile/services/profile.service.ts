import type { Account, ApiResponse, NotificationSettingsBody, UpdateMeBody } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const profileService = {
  updateMe: async (payload: UpdateMeBody) => {
    const { data } = await privateApi.patch<ApiResponse<Account>>('/auth/me', payload);
    return data.result;
  },

  updateNotificationSettings: async (payload: NotificationSettingsBody) => {
    const { data } = await privateApi.patch<ApiResponse<Account>>('/auth/me/notification-settings', payload);
    return data.result;
  },
};
