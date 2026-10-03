import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useCurrentUser } from '~/features/auth';
import { toApiError } from '~/lib/http-errors';
import { bankTransactionsService } from '../services/bankTransactions.service';
import type { IgnoreBankTransactionBody, ListBankTransactionsQuery, ResolveBankTransactionBody } from '../types';

export function useBankTransactions(query: ListBankTransactionsQuery) {
  return useQuery({
    queryKey: ['bank-transactions', 'list', query],
    queryFn: () => bankTransactionsService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useReconciliation(range: { from: string; to: string } | null) {
  return useQuery({
    queryKey: ['bank-transactions', 'reconciliation', range],
    queryFn: () => bankTransactionsService.reconciliation(range!.from, range!.to),
    enabled: Boolean(range),
    retry: false,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['bank-transactions'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    void queryClient.invalidateQueries({ queryKey: ['reports'] });
  };
}

export function useResolveBankTransaction() {
  const manager = useCurrentUser();
  const { message } = App.useApp();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveBankTransactionBody }) =>
      bankTransactionsService.resolve(manager, id, body),
    onSuccess: (transaction) => {
      refresh();
      message.success(`Đã gán cho ${transaction.resolvedAccount?.fullName ?? 'thành viên'}, tiền đã được cộng vào ví.`);
    },
    onError: (error) => message.error(toApiError(error).message),
  });
}

export function useIgnoreBankTransaction() {
  const manager = useCurrentUser();
  const { message } = App.useApp();
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: IgnoreBankTransactionBody }) =>
      bankTransactionsService.ignore(manager, id, body),
    onSuccess: () => {
      refresh();
      message.success('Đã bỏ qua giao dịch');
    },
    onError: (error) => message.error(toApiError(error).message),
  });
}
