import type { ApiResponse, SystemSettings, UpdateSettingsBody } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const settingsService = {
  get: async () => {
    const { data } = await privateApi.get<ApiResponse<SystemSettings>>('/settings');
    return data.result;
  },

  update: async (payload: UpdateSettingsBody) => {
    const { data } = await privateApi.patch<ApiResponse<SystemSettings>>('/settings', payload);
    return data.result;
  },
};
