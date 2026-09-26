import type { Account, ApiResponse, UpdateMeBody } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const profileService = {
  updateMe: async (payload: UpdateMeBody) => {
    const { data } = await privateApi.patch<ApiResponse<Account>>('/auth/me', payload);
    return data.result;
  },
};
