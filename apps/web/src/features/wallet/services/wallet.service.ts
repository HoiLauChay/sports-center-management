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
import { mockErrors, mockRequest } from '~/lib/mock/errors';
import { walletLedger } from '~/lib/mock/ledger';

/** Adds the mock ledger (payments / refunds / counter top-ups) to a wallet loaded from the real API. */
function withLedger(accountId: string, wallet: Wallet, query: WalletQuery): Wallet {
  const extra = walletLedger.entries(accountId, query.type);
  const delta = walletLedger.delta(accountId);
  if (!extra.length && !delta) return wallet;
  const { transactions } = wallet;
  return {
    balance: wallet.balance + delta,
    transactions: {
      ...transactions,
      total: transactions.total + extra.length,
      items: transactions.page === 1 ? [...extra, ...transactions.items] : transactions.items,
    },
  };
}

export interface CounterTopUpInput {
  amount: number;
  method: 'CASH' | 'CARD';
  note?: string;
  idempotencyKey: string;
}

export const walletService = {
  getMine: async (accountId: string, query: WalletQuery): Promise<Wallet> => {
    const { data } = await privateApi.get<ApiResponse<Wallet>>('/me/wallet', { params: query });
    return withLedger(accountId, data.result, query);
  },

  getForMember: async (memberId: string, query: WalletQuery): Promise<Wallet> => {
    const { data } = await privateApi.get<ApiResponse<Wallet>>(`/users/${encodeURIComponent(memberId)}/wallet`, {
      params: query,
    });
    return withLedger(memberId, data.result, query);
  },

  /** Balance of the signed-in member (real balance + mock ledger). */
  balanceOfMine: async (accountId: string) => (await walletService.getMine(accountId, { page: 1, limit: 1 })).balance,

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
   * Cash / card top-up recorded at the counter (`POST /users/{id}/wallet/top-ups`, #113).
   * Mock: the real balance is read first so the ledger entry carries a coherent `balanceAfter`.
   */
  counterTopUp: async (
    memberId: string,
    actor: { id: string; fullName: string },
    input: CounterTopUpInput,
  ): Promise<WalletTransaction> => {
    const serverBalance = (await walletService.getForMember(memberId, { page: 1, limit: 1 })).balance;
    return mockRequest(() => {
      if (input.amount < 1) throw mockErrors.invalid('body.amount', 'Số tiền phải lớn hơn 0');
      return walletLedger.record({
        accountId: memberId,
        serverBalance,
        type: 'TOP_UP',
        amount: input.amount,
        source: 'COUNTER',
        method: input.method,
        createdBy: { id: actor.id, fullName: actor.fullName },
        description: input.note?.trim() || 'Nạp ví tại quầy',
        idempotencyKey: input.idempotencyKey,
      });
    });
  },
};
