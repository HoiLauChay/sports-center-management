import type { ApiResponse } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { MemberMembership, MyMemberships } from '../types';

export const myMembershipsService = {
  list: async (): Promise<MyMemberships> => {
    const { data } = await privateApi.get<ApiResponse<MyMemberships>>('/me/memberships');
    return data.result;
  },
  cancel: async (id: string) => {
    const { data } = await privateApi.post<ApiResponse<MemberMembership>>(
      `/me/memberships/${encodeURIComponent(id)}/cancel`,
    );
    return data.result;
  },
};
