import type { ApiResponse, CreateSportBody, Sport, UpdateSportBody } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const sportsService = {
  list: async () => {
    const { data } = await privateApi.get<ApiResponse<Sport[]>>('/sports');
    return data.result;
  },

  create: async (payload: CreateSportBody) => {
    const { data } = await privateApi.post<ApiResponse<Sport>>('/sports', payload);
    return data.result;
  },

  update: async (id: string, payload: UpdateSportBody) => {
    const { data } = await privateApi.patch<ApiResponse<Sport>>(`/sports/${encodeURIComponent(id)}`, payload);
    return data.result;
  },

  remove: async (id: string) => {
    await privateApi.delete(`/sports/${encodeURIComponent(id)}`);
  },
};
