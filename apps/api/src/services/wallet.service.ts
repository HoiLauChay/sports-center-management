import { ERROR_CODE, type WalletQuery } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toWalletTransactionResponse } from '~/mappers/wallet.mapper';
import accountRepository from '~/repositories/account.repository';
import walletRepository from '~/repositories/wallet.repository';
import { ErrorWithStatus } from '~/rules/error';
import { toPage } from '~/utils/pagination';
import { transactionCode } from '~/utils/paymentCode';

interface CreditInput {
  accountId: string;
  amount: number;
  idempotencyKey: string;
  method: 'CASH' | 'CARD' | 'TRANSFER';
  bankTransactionId?: string;
  createdById?: string;
  requestHash?: string;
  description: string;
}

class WalletService {
  getMine = (accountId: string, query: WalletQuery) => this.load(accountId, query);

  getForMember = async (accountId: string, query: WalletQuery) => {
    if (!(await accountRepository.findById(accountId, 'MEMBER'))) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.NOT_FOUND,
        code: ERROR_CODE.NOT_FOUND,
        message: 'Không tìm thấy thành viên',
      });
    }
    return this.load(accountId, query);
  };

  credit = async (tx: Prisma.TransactionClient, input: CreditInput) => {
    const existing = await walletRepository.findTransactionByKey(input.idempotencyKey, tx);
    if (existing) return existing;

    const balanceAfter = (await walletRepository.readBalance(input.accountId, tx)) + input.amount;
    await walletRepository.updateBalance(input.accountId, balanceAfter, tx);
    return walletRepository.createTransaction(
      {
        accountId: input.accountId,
        transactionCode: transactionCode.generate(),
        idempotencyKey: input.idempotencyKey,
        requestHash: input.requestHash,
        type: 'TOP_UP',
        topUpMethod: input.method,
        amount: input.amount,
        balanceAfter,
        bankTransactionId: input.bankTransactionId,
        createdById: input.createdById,
        description: input.description,
      },
      tx,
    );
  };

  private load = async (accountId: string, query: WalletQuery) => {
    const [profile, [rows, total]] = await Promise.all([
      walletRepository.findBalance(accountId),
      walletRepository.findTransactionPage(accountId, query),
    ]);
    return {
      balance: Number(profile?.walletBalance ?? 0),
      transactions: toPage(rows.map(toWalletTransactionResponse), total, query),
    };
  };
}

export default new WalletService();
