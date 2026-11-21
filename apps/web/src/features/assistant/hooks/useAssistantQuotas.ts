import type { ListAssistantQuotasQuery } from '@sports-center/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { toApiError } from '~/lib/http-errors';
import { assistantQuotasService } from '../services/assistantQuotas.service';

const quotasKey = ['assistant-quotas'] as const;

export const monthLabel = (period: string) => {
  const [year, month] = period.split('-');
  return `${month}/${year}`;
};

export function useAssistantQuotas(query: ListAssistantQuotasQuery) {
  return useQuery({
    queryKey: [...quotasKey, 'list', query],
    queryFn: () => assistantQuotasService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useMemberAssistantQuota(accountId: string) {
  return useQuery({
    queryKey: [...quotasKey, 'member', accountId],
    queryFn: () => assistantQuotasService.ofMember(accountId),
  });
}

/** Resets one member (pass their id) or everyone (pass nothing), then refreshes every quota on screen. */
export function useResetAssistantQuota() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId?: string) => assistantQuotasService.reset(accountId),
    onSuccess: ({ members, period }, accountId) => {
      void queryClient.invalidateQueries({ queryKey: quotasKey });
      const month = monthLabel(period);
      if (accountId) message.success(`Đã trả lại lượt hỏi AI tháng ${month} cho hội viên`);
      else if (members) message.success(`Đã trả lại lượt hỏi AI tháng ${month} cho ${members} hội viên`);
      else message.success(`Chưa hội viên nào dùng lượt hỏi AI tháng ${month}`);
    },
    onError: (err) => message.error(toApiError(err).message),
  });
}
