import type { ApiResponse, Course, CreateCourseBody, UpdateCourseBody } from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const coursesService = {
  list: async () => {
    const { data } = await privateApi.get<ApiResponse<Course[]>>('/courses');
    return data.result;
  },

  create: async (payload: CreateCourseBody) => {
    const { data } = await privateApi.post<ApiResponse<Course>>('/courses', payload);
    return data.result;
  },

  update: async (id: string, payload: UpdateCourseBody) => {
    const { data } = await privateApi.patch<ApiResponse<Course>>(`/courses/${encodeURIComponent(id)}`, payload);
    return data.result;
  },

  remove: async (id: string) => {
    await privateApi.delete(`/courses/${encodeURIComponent(id)}`);
  },
};
