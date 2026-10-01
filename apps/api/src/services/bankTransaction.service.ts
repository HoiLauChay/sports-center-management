import type { InvoicePurpose } from '@sports-center/shared';

import type { Prisma } from '~/generated/prisma/client';
import accountRepository from '~/repositories/account.repository';
import bankTransactionRepository from '~/repositories/bankTransaction.repository';
import invoiceRepository from '~/repositories/invoice.repository';
import invoiceService from '~/services/invoice.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import { extractPaymentCode, retryOnDuplicateCode } from '~/utils/paymentCode';
import { runTransaction } from '~/utils/transaction';

export interface IncomingBankTransaction {
  sepayId: bigint;
  bankName: string;
  accountNumber: string;
  amount: number;
  content: string;
  referenceCode: string | null;
  transactionDate: Date;
  rawPayload: Prisma.InputJsonObject;
}

export type InvoiceSettler = (
  tx: Prisma.TransactionClient,
  input: { invoice: { id: string; accountId: string | null }; bankTransactionId: string },
) => Promise<CreatedNotification[] | null>;

const settlers: Partial<Record<InvoicePurpose, InvoiceSettler>> = {
  WALLET_TOP_UP: invoiceService.settleTopUp,
};

class BankTransactionService {
  ingest = async (input: IncomingBankTransaction) => {
    const { status, notifications } = await retryOnDuplicateCode('transaction_code_key', () =>
      runTransaction(async (tx) => {
        const paymentCode = extractPaymentCode(input.content);
        if (!(await bankTransactionRepository.insertIfNew({ ...input, paymentCode, status: 'UNMATCHED' }, tx))) {
          return { status: 'DUPLICATE' as const, notifications: [] };
        }
        const { id } = await bankTransactionRepository.findBySepayId(input.sepayId, tx);

        const invoice = paymentCode ? await invoiceRepository.findByPaymentCode(paymentCode, tx) : null;
        const settle = invoice && Number(invoice.amount) === input.amount ? settlers[invoice.purpose] : undefined;
        const settled = settle ? await settle(tx, { invoice: invoice!, bankTransactionId: id }) : null;
        if (settled) {
          await bankTransactionRepository.updateStatus(id, 'MATCHED', tx);
          return { status: 'MATCHED' as const, notifications: settled };
        }

        const managerIds = await accountRepository.findActiveManagerIds(tx);
        const amount = input.amount.toLocaleString('vi-VN');
        return {
          status: 'UNMATCHED' as const,
          notifications: await notificationService.create(
            managerIds.map((accountId) => ({
              accountId,
              type: 'PAYMENT' as const,
              title: 'Giao dịch ngân hàng chưa khớp',
              message: `Giao dịch ${amount}đ với nội dung "${input.content}" chưa khớp hóa đơn nào, cần đối soát.`,
              referenceType: 'BANK_TRANSACTION',
              referenceId: id,
              dedupKey: `bank-unmatched:${id}:${accountId}`,
            })),
            tx,
          ),
        };
      }),
    );
    notificationService.sendEmailsAfterCommit(notifications);
    return status;
  };
}

export default new BankTransactionService();
