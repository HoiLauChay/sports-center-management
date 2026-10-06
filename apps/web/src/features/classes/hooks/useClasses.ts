import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { toApiError } from '~/lib/http-errors';
import { classesService, type ListClassesQuery } from '../services/classes.service';

export function useClasses(query: ListClassesQuery) {
  return useQuery({
    queryKey: ['classes', 'list', query],
    queryFn: () => classesService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useClass(id: string) {
  return useQuery({
    queryKey: ['classes', 'detail', id],
    queryFn: () => classesService.get(id),
    retry: false,
  });
}

export function useMyEnrollments() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['enrollments', 'mine', user.id],
    queryFn: () => classesService.listMyEnrollments(user),
  });
}

export function useCancelEnrollment() {
  const user = useCurrentUser();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => classesService.cancelEnrollment(user, id),
    onSuccess: ({ refund }) => {
      void queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      message.success(refund > 0 ? 'Đã hủy đăng ký, tiền đã được hoàn về ví.' : 'Đã hủy đăng ký lớp.');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
}
