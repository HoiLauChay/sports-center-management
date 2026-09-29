import type {
  ApiResponse,
  CreateFacilityBody,
  Facility,
  ListFacilitiesQuery,
  UpdateFacilityBody,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const facilitiesService = {
  list: async (params: ListFacilitiesQuery = {}) => {
    const { data } = await privateApi.get<ApiResponse<Facility[]>>('/facilities', { params });
    return data.result;
  },

  create: async (payload: CreateFacilityBody) => {
    const { data } = await privateApi.post<ApiResponse<Facility>>('/facilities', payload);
    return data.result;
  },

  update: async (id: string, payload: UpdateFacilityBody) => {
    const { data } = await privateApi.patch<ApiResponse<Facility>>(`/facilities/${encodeURIComponent(id)}`, payload);
    return data.result;
  },

  remove: async (id: string) => {
    await privateApi.delete(`/facilities/${encodeURIComponent(id)}`);
  },
};
