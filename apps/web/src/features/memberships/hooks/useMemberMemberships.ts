import type { SubscribeMemberBody } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { walletQueryKey } from '~/features/wallet';
import { formatDate, formatVND } from '~/lib/format';
import { toApiError } from '~/lib/http-errors';
import { memberMembershipsService } from '../services/memberMemberships.service';

const membershipsOfKey = (memberId: string) => ['memberships', 'of', memberId] as const;

export function useMembershipsOf(memberId: string) {
  return useQuery({
    queryKey: membershipsOfKey(memberId),
    queryFn: () => memberMembershipsService.list(memberId),
  });
}

export function useMemberMembershipActions(memberId: string) {
  const queryClient = useQueryClient();
  const { message } = App.useApp();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: membershipsOfKey(memberId) }),
      queryClient.invalidateQueries({ queryKey: walletQueryKey(memberId) }),
      queryClient.invalidateQueries({ queryKey: ['orders'] }),
    ]);
  const onError = (error: unknown) => message.error(toApiError(error).message);

  const subscribe = useMutation({
    mutationFn: (body: SubscribeMemberBody) => memberMembershipsService.subscribe(memberId, body),
    onSuccess: ({ order, membership }) => {
      void refresh();
      message.success(`Đã đăng ký gói ${membership.package.name}, trừ ví ${formatVND(order.totalAmount)}.`);
    },
    onError: (error) => {
      if (toApiError(error).code === 'PRICE_CHANGED') void queryClient.invalidateQueries({ queryKey: ['memberships'] });
      onError(error);
    },
  });

  const cancel = useMutation({
    mutationFn: (membershipId: string) => memberMembershipsService.cancel(memberId, membershipId),
    onSuccess: (membership) => {
      void refresh();
      message.success(`Đã hủy đăng ký. Gói vẫn dùng được đến ${formatDate(membership.endDate)}.`);
    },
    onError,
  });

  const terminate = useMutation({
    mutationFn: ({ membershipId, reason }: { membershipId: string; reason: string }) =>
      memberMembershipsService.terminate(memberId, membershipId, reason),
    onSuccess: () => {
      void refresh();
      message.success('Đã chấm dứt gói, không hoàn tiền.');
    },
    onError,
  });

  return { subscribe, cancel, terminate };
}
