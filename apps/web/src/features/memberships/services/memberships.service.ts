import type { ApiResponse, CreateMembershipBody, MembershipPackage, UpdateMembershipBody } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const membershipsService = {
  list: async () => {
    const { data } = await privateApi.get<ApiResponse<MembershipPackage[]>>('/memberships');
    return data.result;
  },

  create: async (payload: CreateMembershipBody) => {
    const { data } = await privateApi.post<ApiResponse<MembershipPackage>>('/memberships', payload);
    return data.result;
  },

  update: async (id: string, payload: UpdateMembershipBody) => {
    const { data } = await privateApi.patch<ApiResponse<MembershipPackage>>(
      `/memberships/${encodeURIComponent(id)}`,
      payload,
    );
    return data.result;
  },

  remove: async (id: string) => {
    await privateApi.delete(`/memberships/${encodeURIComponent(id)}`);
  },
};
