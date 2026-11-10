import type { ApiResponse, CoachPublicProfile } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const coachesService = {
  getProfile: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<CoachPublicProfile>>(`/coaches/${encodeURIComponent(id)}`);
    return data.result;
  },
};
