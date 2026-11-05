import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { formatDate } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { myMembershipsService } from '../services/myMemberships.service';
import type { MemberMembership, MyMemberships } from '../types';

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
  const replaceCurrent = (updated: MemberMembership) =>
    queryClient.setQueryData<MyMemberships>(
      queryKey,
      (data) =>
        data && {
          ...data,
          current: data.current?.id === updated.id ? updated : data.current,
        },
    );
  const cancel = useMutation({
    mutationFn: (membershipId: string) => myMembershipsService.cancel(membershipId),
    onSuccess: (cancelled) => {
      replaceCurrent(cancelled);
      void refresh();
      message.success(`Đã hủy gói. Bạn vẫn dùng được đến ${formatDate(cancelled.endDate)}.`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  const terminate = useMutation({
    mutationFn: ({ membershipId, reason }: { membershipId: string; reason: string }) =>
      myMembershipsService.terminate(membershipId, reason),
    onSuccess: (terminated) => {
      replaceCurrent(terminated);
      void refresh();
      message.success('Đã chấm dứt gói, không hoàn tiền.');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  return { query, cancel, terminate };
}
