import type { ApiResponse, Paginated } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { CreateSupportBody, ListSupportQuery, SupportRequest, UpdateSupportBody } from '../types';

const path = (id: string) => `/support-requests/${encodeURIComponent(id)}`;

export const supportService = {
  create: async (body: CreateSupportBody) => {
    const { data } = await privateApi.post<ApiResponse<SupportRequest>>('/support-requests', body);
    return data.result;
  },

  listMine: async () => {
    const { data } = await privateApi.get<ApiResponse<SupportRequest[]>>('/me/support-requests');
    return data.result;
  },

  list: async (params: ListSupportQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<SupportRequest>>>('/support-requests', { params });
    return data.result;
  },

  get: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<SupportRequest>>(path(id));
    return data.result;
  },

  update: async (id: string, body: UpdateSupportBody) => {
    const { data } = await privateApi.patch<ApiResponse<SupportRequest>>(path(id), body);
    return data.result;
  },
};
