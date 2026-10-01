import type { Invoice } from '@sports-center/shared';

import { env } from '~/configs/env';
import type { InvoiceRow } from '~/repositories/invoice.repository';

const qrImageUrl = (amount: number, paymentCode: string) => {
  const params = new URLSearchParams({
    acc: env.SEPAY_BANK_ACCOUNT ?? '',
    bank: env.SEPAY_BANK_CODE ?? '',
    amount: String(amount),
    des: paymentCode,
  });
  return `https://qr.sepay.vn/img?${params}`;
};

export const toInvoiceResponse = (row: InvoiceRow): Invoice => {
  const amount = Number(row.amount);
  return {
    id: row.id,
    paymentCode: row.paymentCode,
    purpose: row.purpose,
    account: row.account?.account ?? null,
    guestName: row.guestName,
    guestPhone: row.guestPhone,
    amount,
    status: row.status,
    bankAccount: {
      bankCode: env.SEPAY_BANK_CODE ?? '',
      accountNumber: env.SEPAY_BANK_ACCOUNT ?? '',
      accountName: env.SEPAY_ACCOUNT_NAME ?? '',
    },
    transferContent: row.paymentCode,
    qrImageUrl: qrImageUrl(amount, row.paymentCode),
    expiresAt: row.expiresAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    orderId: row.orderId,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
};
