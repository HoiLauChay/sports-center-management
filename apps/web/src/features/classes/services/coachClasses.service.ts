import type {
  ApiResponse,
  ClassDetail,
  ClassSummary,
  CoachRegistration,
  ListCoachRegistrationsQuery,
  Paginated,
  Specialization,
} from '@sports-center/shared';
import { PAGINATION } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

/** Coach-side class pages: classes needing a coach, registering to teach, the classes taught and withdrawing. */
export const coachClassesService = {
  approvedSpecializations: async (): Promise<Specialization[]> => {
    const { data } = await privateApi.get<ApiResponse<Specialization[]>>('/coach/specializations');
    return data.result.filter((specialization) => specialization.status === 'APPROVED');
  },

  /** Drafts and pending classes of the coach's approved sports that still have no coach (BR_2.14). */
  listOpenClasses: async () => {
    const { data } = await privateApi.get<ApiResponse<Paginated<ClassSummary>>>('/classes', {
      params: { needsCoach: true, page: 1, limit: PAGINATION.MAX_LIMIT },
    });
    return data.result.items;
  },

  myRegistrations: async (params: ListCoachRegistrationsQuery) => {
    const { data } = await privateApi.get<ApiResponse<CoachRegistration[]>>('/coach/registrations', { params });
    return data.result;
  },

  registerToTeach: async (classId: string) => {
    const { data } = await privateApi.post<ApiResponse<CoachRegistration>>(
      `/classes/${encodeURIComponent(classId)}/coach-registrations`,
    );
    return data.result;
  },

  listMyClasses: async () => {
    const { data } = await privateApi.get<ApiResponse<ClassSummary[]>>('/coach/classes');
    return data.result;
  },

  /** Leaves a class that has not started; it goes back to waiting for a coach. */
  withdraw: async (classId: string) => {
    const { data } = await privateApi.post<ApiResponse<ClassDetail>>(
      `/classes/${encodeURIComponent(classId)}/withdraw`,
    );
    return data.result;
  },
};
