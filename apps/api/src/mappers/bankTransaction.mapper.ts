import type { BankTransaction, SepayWebhookBody } from '@sports-center/shared';

import type { Prisma } from '~/generated/prisma/client';
import type { BankTransactionRow } from '~/repositories/bankTransaction.repository';
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

export const toBankTransactionResponse = (row: BankTransactionRow): BankTransaction => ({
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
  resolvedAccount: row.resolvedAccount?.account ?? null,
  handledBy: row.handledBy,
  handledAt: row.handledAt?.toISOString() ?? null,
  note: row.note,
});
