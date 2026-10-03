import type { Person } from '@sports-center/shared';

export const BANK_TX_STATUSES = ['UNMATCHED', 'MATCHED', 'RESOLVED', 'IGNORED'] as const;
export type BankTxStatus = (typeof BANK_TX_STATUSES)[number];

export const BANK_TX_STATUS_TAG: Record<BankTxStatus, { label: string; color?: string }> = {
  UNMATCHED: { label: 'Chưa khớp', color: 'warning' },
  MATCHED: { label: 'Đã khớp tự động', color: 'success' },
  RESOLVED: { label: 'Đã gán thủ công', color: 'processing' },
  IGNORED: { label: 'Đã bỏ qua' },
};

export interface BankTransaction {
  id: string;
  sepayId: number;
  bankName: string;
  accountNumber: string;
  amount: number;
  content: string;
  paymentCode: string | null;
  referenceCode: string | null;
  transactionDate: string;
  status: BankTxStatus;
  topUp: { id: string; account: Person } | null;
  resolvedAccount: Person | null;
  handledBy: Person | null;
  handledAt: string | null;
  note: string | null;
}

export interface ListBankTransactionsQuery {
  page: number;
  limit: number;
  status?: BankTxStatus;
  from?: string;
  to?: string;
  q?: string;
}

export interface ResolveBankTransactionBody {
  accountId: string;
  note: string;
}

export interface IgnoreBankTransactionBody {
  note: string;
}

export interface ReconciliationDay {
  date: string;
  sepay: { count: number; amount: number };
  system: { count: number; amount: number };
  matched: boolean;
  missingSepayIds: number[];
}

export interface Reconciliation {
  days: ReconciliationDay[];
}
