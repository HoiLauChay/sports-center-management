import type {
  ApiResponse,
  CoachScheduleItem,
  MemberScheduleItem,
  PersonalScheduleQuery,
  SessionDetail,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

/** My schedule (`GET /me/schedule`), a coach's teaching schedule (`GET /coach/schedule`) and a day's sessions. */
export const scheduleService = {
  mine: async (range: PersonalScheduleQuery) => {
    const { data } = await privateApi.get<ApiResponse<MemberScheduleItem[]>>('/me/schedule', { params: range });
    return data.result;
  },

  coach: async (range: PersonalScheduleQuery) => {
    const { data } = await privateApi.get<ApiResponse<CoachScheduleItem[]>>('/coach/schedule', { params: range });
    return data.result;
  },

  sessionsOn: async (date: string) => {
    const { data } = await privateApi.get<ApiResponse<SessionDetail[]>>('/sessions', { params: { date } });
    return data.result;
  },
};
