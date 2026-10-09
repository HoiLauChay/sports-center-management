import type {
  ApiResponse,
  CreateTopUpBody,
  Invoice,
  ListMyInvoicesQuery,
  Paginated,
  Wallet,
  WalletQuery,
  WalletTransaction,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export interface CounterTopUpInput {
  amount: number;
  method: 'CASH' | 'CARD';
  note?: string;
  idempotencyKey: string;
}

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

  /**
   * Cash / card top-up recorded at the counter (`POST /users/{id}/wallet/top-ups`, #134).
   */
  counterTopUp: async (
    memberId: string,
    _actor: { id: string; fullName: string },
    input: CounterTopUpInput,
  ): Promise<WalletTransaction> => {
    const { data } = await privateApi.post<ApiResponse<WalletTransaction>>(
      `/users/${encodeURIComponent(memberId)}/wallet/top-ups`,
      {
        amount: input.amount,
        method: input.method,
        note: input.note || undefined,
        idempotencyKey: input.idempotencyKey,
      },
    );
    return data.result;
  },
};
