import type { WalletTransaction, WalletTransactionType } from '@sports-center/shared';
import { createMockStore, newId, nowIso } from './store';

/**
 * Wallet movements produced by mock endpoints (checkout, refunds, counter top-ups). The real wallet API only knows
 * about bank-transfer top-ups, so `walletService` layers this ledger on top of the server balance until the
 * backend (#104, #111, #113, #133) records them itself.
 */
interface LedgerState {
  entries: LedgerEntry[];
  seq: number;
  /** idempotencyKey -> transaction id, so a repeated request returns the first result. */
  keys: Record<string, string>;
}

const store = createMockStore<LedgerState>('sc_mock_wallet_v1', () => ({ entries: [], seq: 0, keys: {} }));

type LedgerEntry = WalletTransaction & { accountId: string };

const toTransaction = (entry: LedgerEntry): WalletTransaction => ({
  id: entry.id,
  transactionCode: entry.transactionCode,
  type: entry.type,
  amount: entry.amount,
  balanceAfter: entry.balanceAfter,
  orderId: entry.orderId,
  orderItemId: entry.orderItemId,
  source: entry.source,
  method: entry.method,
  createdBy: entry.createdBy,
  description: entry.description,
  createdAt: entry.createdAt,
});

const SIGN: Record<WalletTransactionType, 1 | -1> = { TOP_UP: 1, REFUND: 1, PAYMENT: -1 };

export interface LedgerInput {
  accountId: string;
  /** Balance reported by the real API (without the mock overlay). */
  serverBalance: number;
  type: WalletTransactionType;
  amount: number;
  orderId?: string | null;
  orderItemId?: string | null;
  source?: WalletTransaction['source'];
  method?: WalletTransaction['method'];
  createdBy?: WalletTransaction['createdBy'];
  description?: string | null;
  idempotencyKey?: string;
}

export const walletLedger = {
  delta(accountId: string) {
    return store
      .get()
      .entries.filter((entry) => entry.accountId === accountId)
      .reduce((sum, entry) => sum + SIGN[entry.type] * entry.amount, 0);
  },

  /** Newest first. */
  entries(accountId: string, type?: WalletTransactionType): WalletTransaction[] {
    return store
      .get()
      .entries.filter((entry) => entry.accountId === accountId && (!type || entry.type === type))
      .map(toTransaction)
      .reverse();
  },

  record(input: LedgerInput): WalletTransaction {
    return store.update((state) => {
      const known = input.idempotencyKey && state.keys[input.idempotencyKey];
      if (known) {
        return toTransaction(state.entries.find((entry) => entry.id === known)!);
      }
      const before =
        input.serverBalance +
        state.entries
          .filter((entry) => entry.accountId === input.accountId)
          .reduce((sum, entry) => sum + SIGN[entry.type] * entry.amount, 0);
      state.seq += 1;
      const transaction: WalletTransaction = {
        id: newId(),
        transactionCode: `TX${String(state.seq).padStart(6, '0')}`,
        type: input.type,
        amount: input.amount,
        balanceAfter: before + SIGN[input.type] * input.amount,
        orderId: input.orderId ?? null,
        orderItemId: input.orderItemId ?? null,
        source: input.source ?? null,
        method: input.method ?? null,
        createdBy: input.createdBy ?? null,
        description: input.description ?? null,
        createdAt: nowIso(),
      };
      state.entries.push({ ...transaction, accountId: input.accountId });
      if (input.idempotencyKey) state.keys[input.idempotencyKey] = transaction.id;
      return transaction;
    });
  },
};
