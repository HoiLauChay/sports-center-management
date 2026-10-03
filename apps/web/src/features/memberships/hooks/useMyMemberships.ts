import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { toApiError } from '~/lib/http-errors';
import { myMembershipsService } from '../services/myMemberships.service';
import type { MyMemberships } from '../types';

export function useMyMemberships() {
  const { id } = useCurrentUser();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const queryKey = ['memberships', 'mine', id] as const;
  const query = useQuery({
    queryKey,
    queryFn: myMembershipsService.list,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const autoRenew = useMutation({
    mutationFn: ({ membershipId, enabled }: { membershipId: string; enabled: boolean }) =>
      myMembershipsService.setAutoRenew(membershipId, enabled),
    onSuccess: (updated, { enabled }) => {
      queryClient.setQueryData<MyMemberships>(
        queryKey,
        (data) =>
          data && {
            ...data,
            current: data.current?.id === updated.id ? updated : data.current,
            history: data.history.map((membership) => (membership.id === updated.id ? updated : membership)),
          },
      );
      void refresh();
      message.success(enabled ? 'Đã bật tự động gia hạn' : 'Đã tắt tự động gia hạn');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  const cancel = useMutation({
    mutationFn: (membershipId: string) => myMembershipsService.cancel(membershipId),
    onSuccess: (cancelled) => {
      queryClient.setQueryData<MyMemberships>(
        queryKey,
        (data) =>
          data && {
            current: data.current?.id === cancelled.id ? null : data.current,
            history: [cancelled, ...data.history.filter(({ id }) => id !== cancelled.id)],
          },
      );
      void refresh();
      message.success('Đã hủy gói. Quyền lợi đã dừng.');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  return { query, autoRenew, cancel };
}
