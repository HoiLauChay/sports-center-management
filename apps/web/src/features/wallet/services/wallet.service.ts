import type {
  ApiResponse,
  CreateTopUpBody,
  Invoice,
  ListMyInvoicesQuery,
  Paginated,
  Wallet,
  WalletQuery,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const walletService = {
  getMine: async (query: WalletQuery) => {
    const { data } = await privateApi.get<ApiResponse<Wallet>>('/me/wallet', { params: query });
    return data.result;
  },

  /** Creates a top-up invoice (QR). */
  createTopUp: async (body: CreateTopUpBody) => {
    const { data } = await privateApi.post<ApiResponse<Invoice>>('/wallet/top-ups', body);
    return data.result;
  },

  listInvoices: async (query: ListMyInvoicesQuery) => {
    const { data } = await privateApi.get<ApiResponse<Paginated<Invoice>>>('/me/invoices', { params: query });
    return data.result;
  },

  getInvoice: async (id: string) => {
    const { data } = await privateApi.get<ApiResponse<Invoice>>(`/invoices/${encodeURIComponent(id)}`);
    return data.result;
  },
};
