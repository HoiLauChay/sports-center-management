import type {
  ApiResponse,
  CancelEnrollmentResult,
  ClassDetail,
  ListClassesQuery as ClassesQuery,
  ClassSummary,
  CreateClassBody,
  Enrollment,
  MyEnrollment,
  Paginated,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export type ListClassesQuery = Pick<ClassesQuery, 'page' | 'limit' | 'sportId' | 'coachId' | 'q'>;
export type ManagerClassesQuery = Pick<ClassesQuery, 'page' | 'limit' | 'status' | 'derivedStatus' | 'courseId'>;

/** Classes (catalog, detail, manager list, create), my enrollments and their cancellation. */
export const classesService = {
  list: async (query: ListClassesQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<ClassSummary>>>('/classes', {
      params: { ...query, openForEnrollment: true },
    });
    return data.result;
  },

  get: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<ClassDetail>>(`/classes/${encodeURIComponent(id)}`);
    return data.result;
  },

  enrollments: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Enrollment[]>>(`/classes/${encodeURIComponent(id)}/enrollments`);
    return data.result;
  },

  listForManager: async (query: ManagerClassesQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<ClassSummary>>>('/classes', { params: query });
    return data.result;
  },

  create: async (body: CreateClassBody) => {
    const { data } = await privateApi.post<ApiResponse<ClassDetail>>('/classes', body);
    return data.result;
  },

  listMyEnrollments: async () => {
    const { data } = await privateApi.get<ApiResponse<MyEnrollment[]>>('/me/enrollments');
    return data.result;
  },

  cancelEnrollment: async (id: string) => {
    const { data } = await privateApi.post<ApiResponse<CancelEnrollmentResult>>(
      `/enrollments/${encodeURIComponent(id)}/cancel`,
    );
    return data.result;
  },
};
