import { ERROR_CODE, type CounterTopUpBody, type WalletQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { toWalletTransactionResponse } from '~/mappers/wallet.mapper';
import accountRepository from '~/repositories/account.repository';
import walletRepository from '~/repositories/wallet.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import { hashRequest, idempotencyKey, withIdempotency } from '~/utils/idempotency';
import { toPage } from '~/utils/pagination';
import { retryOnDuplicateCode, transactionCode } from '~/utils/paymentCode';
import { lockRows, runTransaction } from '~/utils/transaction';

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

interface PayInput {
  accountId: string;
  orderId: string;
  amount: number;
  createdById?: string;
  description: string;
}

interface RefundInput {
  accountId: string;
  orderId: string;
  orderItemId: string;
  amount: number;
  idempotencyKey: string;
  createdById?: string;
  description: string;
}

const memberNotFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy thành viên',
  });

class WalletService {
  getMine = (accountId: string, query: WalletQuery) => this.load(accountId, query);

  getForMember = async (accountId: string, query: WalletQuery) => {
    if (!(await accountRepository.findById(accountId, 'MEMBER'))) throw memberNotFound();
    return this.load(accountId, query);
  };

  topUpAtCounter = async (receptionistId: string, accountId: string, body: CounterTopUpBody, ip?: string) => {
    const { idempotencyKey: clientKey, ...payload } = body;
    const key = idempotencyKey.cash(receptionistId, clientKey);
    const requestHash = hashRequest({ accountId, ...payload });
    let notifications: CreatedNotification[] = [];

    const transaction = await withIdempotency({
      requestHash,
      find: () => walletRepository.findTransactionByKey(key, prisma),
      execute: () =>
        retryOnDuplicateCode('transaction_code_key', () =>
          runTransaction(async (tx) => {
            await lockRows(tx, { accounts: [accountId], memberProfiles: [accountId] });
            const replayed = await walletRepository.findTransactionByKey(key, tx);
            if (replayed) return replayed;
            const member = await accountRepository.findById(accountId, 'MEMBER', tx);
            if (member?.status !== 'ACTIVE') throw memberNotFound();

            const created = await this.credit(tx, {
              accountId,
              amount: body.amount,
              idempotencyKey: key,
              requestHash,
              method: body.method,
              createdById: receptionistId,
              description: body.note || 'Nạp tiền tại quầy',
            });
            await auditService.record(
              {
                accountId: receptionistId,
                action: 'CREATE',
                entityType: 'WALLET_TRANSACTION',
                entityId: created.id,
                newValues: created,
                ipAddress: ip,
              },
              tx,
            );
            notifications = await notificationService.create(
              [
                {
                  accountId,
                  type: 'PAYMENT',
                  title: 'Nạp ví thành công',
                  message: `Ví của bạn đã được cộng ${body.amount.toLocaleString('vi-VN')}đ tại quầy.`,
                  referenceType: 'WALLET_TRANSACTION',
                  referenceId: created.id,
                  dedupKey: `counter-top-up:${created.id}`,
                  sendEmail: true,
                },
              ],
              tx,
            );
            return created;
          }),
        ),
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toWalletTransactionResponse(transaction);
  };

  pay = async (tx: Prisma.TransactionClient, input: PayInput) => {
    if (input.amount === 0) return null;
    const key = idempotencyKey.payment(input.orderId);
    const existing = await walletRepository.findTransactionByKey(key, tx);
    if (existing) return existing;

    const balance = await walletRepository.readBalance(input.accountId, tx);
    if (balance < input.amount) {
      throw new ErrorWithStatus({
        status: HTTP_STATUS.CONFLICT,
        code: ERROR_CODE.INSUFFICIENT_BALANCE,
        message: 'Số dư ví không đủ',
        meta: { balance, required: input.amount },
      });
    }

    const balanceAfter = balance - input.amount;
    await walletRepository.updateBalance(input.accountId, balanceAfter, tx);
    return walletRepository.createTransaction(
      {
        accountId: input.accountId,
        transactionCode: transactionCode.generate(),
        idempotencyKey: key,
        type: 'PAYMENT',
        amount: input.amount,
        balanceAfter,
        orderId: input.orderId,
        createdById: input.createdById,
        description: input.description,
      },
      tx,
    );
  };

  refund = async (tx: Prisma.TransactionClient, input: RefundInput) => {
    if (input.amount === 0) return null;
    const existing = await walletRepository.findTransactionByKey(input.idempotencyKey, tx);
    if (existing) return existing;

    const balanceAfter = (await walletRepository.readBalance(input.accountId, tx)) + input.amount;
    await walletRepository.updateBalance(input.accountId, balanceAfter, tx);
    return walletRepository.createTransaction(
      {
        accountId: input.accountId,
        transactionCode: transactionCode.generate(),
        idempotencyKey: input.idempotencyKey,
        type: 'REFUND',
        amount: input.amount,
        balanceAfter,
        orderId: input.orderId,
        orderItemId: input.orderItemId,
        createdById: input.createdById,
        description: input.description,
      },
      tx,
    );
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
