import type {
  ApiResponse,
  BankTransaction,
  IgnoreBankTransactionBody,
  ListBankTransactionsQuery,
  Paginated,
  Reconciliation,
  ReconciliationQuery,
  ResolveBankTransactionBody,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const bankTransactionsService = {
  list: async (params: ListBankTransactionsQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<BankTransaction>>>('/bank-transactions', { params });
    return data.result;
  },

  resolve: async (id: string, body: ResolveBankTransactionBody) => {
    const { data } = await privateApi.post<ApiResponse<BankTransaction>>(
      `/bank-transactions/${encodeURIComponent(id)}/resolve`,
      body,
    );
    return data.result;
  },

  ignore: async (id: string, body: IgnoreBankTransactionBody) => {
    const { data } = await privateApi.post<ApiResponse<BankTransaction>>(
      `/bank-transactions/${encodeURIComponent(id)}/ignore`,
      body,
    );
    return data.result;
  },

  reconciliation: async (params: ReconciliationQuery) => {
    const { data } = await privateApi.get<ApiResponse<Reconciliation>>('/bank-transactions/reconciliation', {
      params,
    });
    return data.result;
  },
};
