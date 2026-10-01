import type { WalletTransaction } from '@sports-center/shared';

import type { WalletTransactionRow } from '~/repositories/wallet.repository';

const topUpSource = (row: WalletTransactionRow): Pick<WalletTransaction, 'source' | 'method'> => {
  if (row.type !== 'TOP_UP' || !row.topUpMethod || row.topUpMethod === 'WALLET') return { source: null, method: null };
  return { source: row.bankTransactionId ? 'BANK_TRANSFER' : 'COUNTER', method: row.topUpMethod };
};

export const toWalletTransactionResponse = (row: WalletTransactionRow): WalletTransaction => ({
  id: row.id,
  transactionCode: row.transactionCode,
  type: row.type,
  amount: Number(row.amount),
  balanceAfter: Number(row.balanceAfter),
  orderId: row.orderId,
  orderItemId: row.orderItemId,
  ...topUpSource(row),
  createdBy: row.createdBy,
  description: row.description,
  createdAt: row.createdAt.toISOString(),
});
