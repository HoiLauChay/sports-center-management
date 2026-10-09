import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { describeApiError } from '~/lib/http-errors';
import { supportService } from '../services/support.service';
import type { ListSupportQuery, UpdateSupportBody } from '../types';

/** Members see status changes made by the receptionist without reloading: the list is re-read every 15 seconds. */
const MEMBER_POLL_MS = 15_000;

export function useMySupportRequests() {
  const user = useCurrentUser();
  return useQuery({
    queryKey: ['support', 'mine', user.id],
    queryFn: supportService.listMine,
    refetchInterval: MEMBER_POLL_MS,
  });
}

export function useCreateSupportRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supportService.create,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['support'] }),
  });
}

export function useSupportRequests(query: ListSupportQuery) {
  return useQuery({
    queryKey: ['support', 'list', query],
    queryFn: () => supportService.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: MEMBER_POLL_MS,
  });
}

export function useUpdateSupportRequest() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSupportBody }) => supportService.update(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support'] });
      message.success('Đã cập nhật yêu cầu hỗ trợ');
    },
    onError: (error) => message.error(describeApiError(error)),
  });
}
