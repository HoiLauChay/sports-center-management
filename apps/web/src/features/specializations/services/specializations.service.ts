import type { ApiResponse, CreateSpecializationInput, Paginated } from '@sports-center/shared';
import { privateApi } from '~/lib/http';
import type { ListSpecializationsQuery, Specialization } from '../types';

const review = (action: 'approve' | 'reject') => async (id: string, reviewNote?: string) => {
  const { data } = await privateApi.post<ApiResponse<Specialization>>(
    `/specializations/${encodeURIComponent(id)}/${action}`,
    { reviewNote: reviewNote?.trim() || undefined },
  );
  return data.result;
};

/** Coach specializations: a coach registers sports (`/coach/specializations`), a manager reviews them (`/specializations`). */
export const specializationsService = {
  listMine: async () => {
    const { data } = await privateApi.get<ApiResponse<Specialization[]>>('/coach/specializations');
    return data.result;
  },

  register: async (body: CreateSpecializationInput) => {
    const { data } = await privateApi.post<ApiResponse<Specialization>>('/coach/specializations', body);
    return data.result;
  },

  list: async (params: ListSpecializationsQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<Specialization>>>('/specializations', { params });
    return data.result;
  },

  approve: review('approve'),

  reject: review('reject'),
};
