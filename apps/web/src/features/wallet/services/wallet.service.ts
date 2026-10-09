import type {
  ApiResponse,
  CounterTopUpBody,
  CreateTopUpBody,
  Invoice,
  ListMyInvoicesQuery,
  Paginated,
  Wallet,
  WalletQuery,
  WalletTransaction,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const walletService = {
  getMine: async (query: WalletQuery) => {
    const { data } = await privateApi.get<ApiResponse<Wallet>>('/me/wallet', { params: query });
    return data.result;
  },

  getForMember: async (memberId: string, query: WalletQuery) => {
    const { data } = await privateApi.get<ApiResponse<Wallet>>(`/users/${encodeURIComponent(memberId)}/wallet`, {
      params: query,
    });
    return data.result;
  },

  balanceOfMine: async () => (await walletService.getMine({ page: 1, limit: 1 })).balance,

  balanceOfMember: async (memberId: string) =>
    (await walletService.getForMember(memberId, { page: 1, limit: 1 })).balance,

  /** Creates a top-up invoice (QR). Receptionists pass the `accountId` of the member being topped up. */
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

  /** Cash or card top-up recorded at the counter. */
  counterTopUp: async (memberId: string, body: CounterTopUpBody) => {
    const { data } = await privateApi.post<ApiResponse<WalletTransaction>>(
      `/users/${encodeURIComponent(memberId)}/wallet/top-ups`,
      body,
    );
    return data.result;
  },
};
