import type { Course, CreateCourseBody, UpdateCourseBody } from '@sports-center/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { toApiError } from '~/lib/http-errors';
import { coursesService } from '../services/courses.service';

export const coursesQueryOptions = queryOptions({
  queryKey: ['courses', 'list'],
  queryFn: () => coursesService.list(),
});

export function useCourses() {
  return useQuery(coursesQueryOptions);
}

export function useCreateCourse(onSuccess?: (created: Course) => void) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: (body: CreateCourseBody) => coursesService.create(body),
    onSuccess: (course) => {
      void queryClient.invalidateQueries({ queryKey: coursesQueryOptions.queryKey });
      message.success(`Đã tạo khóa học "${course.name}"`);
      onSuccess?.(course);
    },
  });
}

export function useUpdateCourse(onSuccess?: (updated: Course) => void) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateCourseBody }) => coursesService.update(id, body),
    onSuccess: (course) => {
      void queryClient.invalidateQueries({ queryKey: coursesQueryOptions.queryKey });
      message.success(`Đã cập nhật khóa học "${course.name}"`);
      onSuccess?.(course);
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  return useMutation({
    mutationFn: (id: string) => coursesService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: coursesQueryOptions.queryKey });
      message.success('Đã xóa khóa học');
    },
    onError: (err) => {
      message.error(toApiError(err).message);
    },
  });
}
