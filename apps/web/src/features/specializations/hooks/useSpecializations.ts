import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { describeApiError } from '~/lib/http-errors';
import { specializationsService } from '../services/specializations.service';
import type { ListSpecializationsQuery } from '../types';

/** A coach sees the manager's decision without reloading: the list is re-read every 30 seconds. */
const COACH_POLL_MS = 30_000;

export function useMySpecializations() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['specializations', 'mine', user.id],
    queryFn: specializationsService.listMine,
    refetchInterval: COACH_POLL_MS,
  });
}

export function useRegisterSpecialization() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: specializationsService.register,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['specializations'] });
      message.success('Đã gửi, chờ Quản lý duyệt.');
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}

export function useSpecializations(query: ListSpecializationsQuery) {
  return useQuery({
    queryKey: ['specializations', 'list', query],
    queryFn: () => specializationsService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useReviewSpecialization() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, reviewNote }: { id: string; approve: boolean; reviewNote?: string }) =>
      approve ? specializationsService.approve(id, reviewNote) : specializationsService.reject(id, reviewNote),
    onSuccess: (specialization) => {
      void queryClient.invalidateQueries({ queryKey: ['specializations'] });
      message.success(
        specialization.status === 'APPROVED'
          ? `Đã duyệt ${specialization.sport.name} cho ${specialization.coach.fullName}.`
          : `Đã từ chối ${specialization.sport.name} của ${specialization.coach.fullName}.`,
      );
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}
