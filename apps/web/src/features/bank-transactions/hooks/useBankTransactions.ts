import type {
  IgnoreBankTransactionBody,
  ListBankTransactionsQuery,
  ReconciliationQuery,
  ResolveBankTransactionBody,
} from '@sports-center/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { describeApiError, toApiError } from '~/lib/http-errors';
import { bankTransactionsService } from '../services/bankTransactions.service';

export function useBankTransactions(query: ListBankTransactionsQuery) {
  return useQuery({
    queryKey: ['bank-transactions', 'list', query],
    queryFn: () => bankTransactionsService.list(query),
    placeholderData: keepPreviousData,
  });
}

export function useReconciliation(range: ReconciliationQuery) {
  return useQuery({
    queryKey: ['bank-transactions', 'reconciliation', range],
    queryFn: () => bankTransactionsService.reconciliation(range),
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

function useHandledError() {
  const { message } = App.useApp();
  const refresh = useRefresh();
  return (error: unknown) => {
    if (toApiError(error).code === 'BANK_TRANSACTION_HANDLED') refresh();
    message.error(describeApiError(error));
  };
}

export function useResolveBankTransaction() {
  const { message } = App.useApp();
  const refresh = useRefresh();
  const onError = useHandledError();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResolveBankTransactionBody }) =>
      bankTransactionsService.resolve(id, body),
    onSuccess: (transaction) => {
      refresh();
      message.success(`Đã gán cho ${transaction.resolvedAccount?.fullName ?? 'thành viên'}, tiền đã được cộng vào ví.`);
    },
    onError,
  });
}

export function useIgnoreBankTransaction() {
  const { message } = App.useApp();
  const refresh = useRefresh();
  const onError = useHandledError();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: IgnoreBankTransactionBody }) =>
      bankTransactionsService.ignore(id, body),
    onSuccess: () => {
      refresh();
      message.success('Đã bỏ qua giao dịch');
    },
    onError,
  });
}
