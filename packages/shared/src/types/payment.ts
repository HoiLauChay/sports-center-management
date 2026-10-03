import type { BankTransactionStatus, InvoicePurpose } from '../constants/enums';
import type { Person } from './audit';

export interface BankTransaction {
  id: string;
  sepayId: number | null;
  bankName: string;
  accountNumber: string;
  amount: number;
  content: string;
  paymentCode: string | null;
  referenceCode: string | null;
  transactionDate: string;
  status: BankTransactionStatus;
  invoice: { id: string; purpose: InvoicePurpose; account: Person | null } | null;
  resolvedAccount: Person | null;
  handledBy: Person | null;
  handledAt: string | null;
  note: string | null;
}

export interface ReconciliationDay {
  date: string;
  sepay: { count: number; amount: number };
  system: { count: number; amount: number };
  matched: boolean;
  missingReferenceCodes: string[];
}

export interface Reconciliation {
  days: ReconciliationDay[];
}

export interface SepaySyncResult {
  skipped: boolean;
  partial: boolean;
  fetched: number;
  inserted: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  missedWebhooks: number;
}
