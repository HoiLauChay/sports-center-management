import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { formatDate } from '~/lib/format';
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
  const cancel = useMutation({
    mutationFn: (membershipId: string) => myMembershipsService.cancel(membershipId),
    onSuccess: (cancelled) => {
      queryClient.setQueryData<MyMemberships>(
        queryKey,
        (data) =>
          data && {
            ...data,
            current: data.current?.id === cancelled.id ? cancelled : data.current,
          },
      );
      void refresh();
      message.success(`Đã hủy gói. Bạn vẫn dùng được đến ${formatDate(cancelled.endDate)}.`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });
  return { query, cancel };
}
