import type { BankTransaction, BankTransactionIssue, SepayWebhookBody } from '@sports-center/shared';

import type { Prisma } from '~/generated/prisma/client';
import type { BankTransactionRow, CodeInvoiceRow } from '~/repositories/bankTransaction.repository';
import type { IncomingBankTransaction } from '~/services/bankTransaction.service';
import type { SepayTransaction } from '~/utils/sepayApi';

const fromCenterDateTime = (value: string) => new Date(`${value.replace(' ', 'T')}+07:00`);

export const fromSepayWebhook = (body: SepayWebhookBody): IncomingBankTransaction => ({
  sepayId: BigInt(body.id),
  bankName: body.gateway,
  accountNumber: body.accountNumber,
  amount: body.transferAmount,
  content: body.content,
  referenceCode: body.referenceCode || null,
  transactionDate: fromCenterDateTime(body.transactionDate),
  rawPayload: body as Prisma.InputJsonObject,
});

export const fromSepayApi = (row: SepayTransaction): IncomingBankTransaction => ({
  sepayId: null,
  bankName: row.bank_brand_name,
  accountNumber: row.account_number,
  amount: row.amount_in,
  content: row.transaction_content,
  referenceCode: row.reference_number || null,
  transactionDate: fromCenterDateTime(row.transaction_date),
  rawPayload: row as unknown as Prisma.InputJsonObject,
});

const issueOf = (row: BankTransactionRow, invoice: CodeInvoiceRow | null): BankTransactionIssue | null => {
  if (row.status !== 'UNMATCHED') return null;
  if (!row.paymentCode) return 'NO_CODE';
  if (!invoice) return 'UNKNOWN_CODE';
  if (invoice.bankTransaction && invoice.bankTransaction.id !== row.id) return 'ALREADY_PAID';
  if (Number(invoice.amount) !== Number(row.amount)) return 'AMOUNT_MISMATCH';
  return 'INVOICE_CLOSED';
};

export const toBankTransactionResponse = (
  row: BankTransactionRow,
  invoice: CodeInvoiceRow | null = null,
): BankTransaction => ({
  id: row.id,
  sepayId: row.sepayId === null ? null : Number(row.sepayId),
  bankName: row.bankName,
  accountNumber: row.accountNumber,
  amount: Number(row.amount),
  content: row.content,
  paymentCode: row.paymentCode,
  referenceCode: row.referenceCode,
  transactionDate: row.transactionDate.toISOString(),
  status: row.status,
  invoice: row.invoice
    ? { id: row.invoice.id, purpose: row.invoice.purpose, account: row.invoice.account?.account ?? null }
    : null,
  codeInvoice: invoice && {
    id: invoice.id,
    purpose: invoice.purpose,
    status: invoice.status,
    amount: Number(invoice.amount),
    account: invoice.account?.account ?? null,
    guestName: invoice.guestName,
    guestPhone: invoice.guestPhone,
    createdAt: invoice.createdAt.toISOString(),
    paidBy:
      invoice.bankTransaction && invoice.bankTransaction.id !== row.id
        ? {
            id: invoice.bankTransaction.id,
            transactionDate: invoice.bankTransaction.transactionDate.toISOString(),
            amount: Number(invoice.bankTransaction.amount),
            referenceCode: invoice.bankTransaction.referenceCode,
          }
        : null,
  },
  issue: issueOf(row, invoice),
  resolvedAccount: row.resolvedAccount?.account ?? null,
  handledBy: row.handledBy,
  handledAt: row.handledAt?.toISOString() ?? null,
  note: row.note,
});
