import type { BankTransactionStatus, InvoicePurpose, InvoiceStatus } from '../constants/enums';
import type { Person } from './audit';

/** Why a transfer did not settle its invoice on its own. */
export type BankTransactionIssue =
  /** No payment code in the transfer content. */
  | 'NO_CODE'
  /** A code that belongs to no invoice. */
  | 'UNKNOWN_CODE'
  /** The invoice was already paid by another transfer: the customer paid twice. */
  | 'ALREADY_PAID'
  /** The amount differs from the invoice. */
  | 'AMOUNT_MISMATCH'
  /** The invoice had expired or was cancelled when the money arrived. */
  | 'INVOICE_CLOSED';

/** The invoice the transfer's payment code points to, i.e. who meant to pay and for what. */
export interface BankTransactionCodeInvoice {
  id: string;
  purpose: InvoicePurpose;
  status: InvoiceStatus;
  amount: number;
  account: (Person & { phone: string | null }) | null;
  guestName: string | null;
  guestPhone: string | null;
  createdAt: string;
  /** The transfer that settled the invoice, when it is not this one. */
  paidBy: { id: string; transactionDate: string; amount: number; referenceCode: string | null } | null;
}

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
  codeInvoice: BankTransactionCodeInvoice | null;
  /** Set only while the transfer is unmatched. */
  issue: BankTransactionIssue | null;
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
