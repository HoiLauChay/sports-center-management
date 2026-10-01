import type { InvoicePurpose, InvoiceStatus, WalletTransactionType } from '../constants/enums';
import type { Paginated } from './api';
import type { Person } from './audit';

export interface WalletTransaction {
  id: string;
  transactionCode: string;
  type: WalletTransactionType;
  amount: number;
  balanceAfter: number;
  orderId: string | null;
  orderItemId: string | null;
  source: 'BANK_TRANSFER' | 'COUNTER' | null;
  method: 'CASH' | 'CARD' | 'TRANSFER' | null;
  createdBy: Person | null;
  description: string | null;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  transactions: Paginated<WalletTransaction>;
}

export interface Invoice {
  id: string;
  paymentCode: string;
  purpose: InvoicePurpose;
  account: Person | null;
  guestName: string | null;
  guestPhone: string | null;
  amount: number;
  status: InvoiceStatus;
  bankAccount: { bankCode: string; accountNumber: string; accountName: string };
  transferContent: string;
  qrImageUrl: string;
  expiresAt: string;
  paidAt: string | null;
  orderId: string | null;
  createdBy: Person;
  createdAt: string;
}
