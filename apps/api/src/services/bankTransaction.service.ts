import {
  ERROR_CODE,
  type IgnoreBankTransactionBody,
  type InvoicePurpose,
  type ListBankTransactionsQuery,
  type ReconciliationDay,
  type ReconciliationQuery,
  type ResolveBankTransactionBody,
  type SepaySyncResult,
} from '@sports-center/shared';

import { env } from '~/configs/env';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma } from '~/generated/prisma/client';
import { fromSepayApi, toBankTransactionResponse } from '~/mappers/bankTransaction.mapper';
import accountRepository from '~/repositories/account.repository';
import bankTransactionRepository from '~/repositories/bankTransaction.repository';
import invoiceRepository from '~/repositories/invoice.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import checkoutService from '~/services/checkout/checkout.service';
import invoiceService from '~/services/invoice.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import walletService from '~/services/wallet.service';
import { idempotencyKey } from '~/utils/idempotency';
import { toPage } from '~/utils/pagination';
import { extractPaymentCode, retryOnDuplicateCode } from '~/utils/paymentCode';
import { sepayApi, SepayUnavailableError, type SepayTransaction } from '~/utils/sepayApi';
import { todayInCenter } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

export interface IncomingBankTransaction {
  sepayId: bigint | null;
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
) => Promise<{ matched: boolean; notifications: CreatedNotification[]; note?: string } | null>;

const settlers: Partial<Record<InvoicePurpose, InvoiceSettler>> = {
  WALLET_TOP_UP: invoiceService.settleTopUp,
  COUNTER_ORDER: checkoutService.settleCounterOrder,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNC_LOOKBACK_DAYS = 2;

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy giao dịch ngân hàng',
  });

const alreadyHandled = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.BANK_TRANSACTION_HANDLED,
    message: 'Giao dịch này đã được xử lý',
  });

const upstreamUnavailable = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.SERVICE_UNAVAILABLE,
    code: ERROR_CODE.UPSTREAM_UNAVAILABLE,
    message: 'Không lấy được dữ liệu từ SePay, vui lòng thử lại sau',
  });

const eachDay = (from: string, to: string) => {
  const days: string[] = [];
  for (let time = Date.parse(from); time <= Date.parse(to); time += DAY_MS) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
};

class BankTransactionService {
  ingest = async (input: IncomingBankTransaction) => {
    if (env.SEPAY_BANK_ACCOUNT && input.accountNumber !== env.SEPAY_BANK_ACCOUNT) return 'FOREIGN_ACCOUNT' as const;

    const { status, notifications } = await retryOnDuplicateCode('transaction_code_key', () =>
      runTransaction(async (tx) => {
        const duplicate = { status: 'DUPLICATE' as const, notifications: [] };
        if (input.sepayId === null && input.referenceCode === null) {
          if (await bankTransactionRepository.existsWithoutReference(input, tx)) return duplicate;
        }

        const paymentCode = extractPaymentCode(input.content);
        const inserted = await bankTransactionRepository.insertIfNew(
          { ...input, paymentCode, status: 'UNMATCHED' },
          tx,
        );
        if (!inserted) return duplicate;
        const { id } = inserted;

        const invoice = paymentCode ? await invoiceRepository.findByPaymentCode(paymentCode, tx) : null;
        const settle = invoice && Number(invoice.amount) === input.amount ? settlers[invoice.purpose] : undefined;
        const settled = settle ? await settle(tx, { invoice: invoice!, bankTransactionId: id }) : null;
        if (settled?.matched) {
          await bankTransactionRepository.updateStatus(id, 'MATCHED', tx);
          return { status: 'MATCHED' as const, notifications: settled.notifications };
        }
        if (settled?.note) await bankTransactionRepository.updateStatus(id, 'UNMATCHED', tx, settled.note);

        const managerIds = await accountRepository.findActiveManagerIds(tx);
        const amount = input.amount.toLocaleString('vi-VN');
        const managerNotifications = await notificationService.create(
          managerIds.map((accountId) => ({
            accountId,
            type: 'PAYMENT' as const,
            title: 'Giao dịch ngân hàng chưa khớp',
            message: `Giao dịch ${amount}đ với nội dung "${input.content}" ${settled?.note ? `chưa khớp (${settled.note})` : 'chưa khớp hóa đơn nào'}, cần đối soát.`,
            referenceType: 'BANK_TRANSACTION',
            referenceId: id,
            dedupKey: `bank-unmatched:${id}:${accountId}`,
          })),
          tx,
        );
        return {
          status: 'UNMATCHED' as const,
          notifications: [...(settled?.notifications ?? []), ...managerNotifications],
        };
      }),
    );
    notificationService.sendEmailsAfterCommit(notifications);
    return status;
  };

  syncFromSepay = async (now = new Date()): Promise<SepaySyncResult> => {
    const result: SepaySyncResult = {
      skipped: false,
      partial: false,
      fetched: 0,
      inserted: 0,
      matched: 0,
      unmatched: 0,
      duplicates: 0,
      missedWebhooks: 0,
    };
    if (!sepayApi.isConfigured()) return { ...result, skipped: true };

    const from = todayInCenter(new Date(now.getTime() - SYNC_LOOKBACK_DAYS * DAY_MS));
    try {
      for await (const rows of sepayApi.incomingPages({ from })) {
        for (const row of rows) {
          result.fetched += 1;
          if (row.webhook_success === 0) result.missedWebhooks += 1;
          const status = await this.ingest(fromSepayApi(row));
          if (status === 'MATCHED') result.matched += 1;
          if (status === 'UNMATCHED') result.unmatched += 1;
          if (status === 'DUPLICATE') result.duplicates += 1;
        }
      }
    } catch (err) {
      if (!(err instanceof SepayUnavailableError)) throw err;
      result.partial = true;
    }
    result.inserted = result.matched + result.unmatched;
    return result;
  };

  list = async (query: ListBankTransactionsQuery) => {
    const [rows, total] = await bankTransactionRepository.findPage(query);
    return toPage(rows.map(toBankTransactionResponse), total, query);
  };

  resolve = async (managerId: string, id: string, body: ResolveBankTransactionBody, ip?: string) => {
    let notifications: CreatedNotification[] = [];
    const row = await retryOnDuplicateCode('transaction_code_key', () =>
      runTransaction(async (tx) => {
        await lockRows(tx, {
          accounts: [body.accountId],
          memberProfiles: [body.accountId],
          bankTransactions: [id],
        });
        const current = await bankTransactionRepository.findById(id, tx);
        if (!current) throw notFound();
        if (current.status !== 'UNMATCHED') throw alreadyHandled();

        const member = await accountRepository.findById(body.accountId, 'MEMBER', tx);
        if (member?.status !== 'ACTIVE') {
          throw new ErrorWithStatus({
            status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
            code: ERROR_CODE.VALIDATION,
            message: 'Dữ liệu không hợp lệ',
            errors: [{ path: 'body.accountId', message: 'Thành viên không tồn tại' }],
          });
        }

        const amount = Number(current.amount);
        await walletService.credit(tx, {
          accountId: member.id,
          amount,
          idempotencyKey: idempotencyKey.sepay(id),
          method: 'TRANSFER',
          bankTransactionId: id,
          createdById: managerId,
          description: `Nạp ví từ giao dịch ngân hàng ${current.referenceCode ?? current.content}`,
        });
        const updated = await bankTransactionRepository.handle(
          id,
          {
            status: 'RESOLVED',
            resolvedAccountId: member.id,
            handledById: managerId,
            handledAt: new Date(),
            note: body.note,
          },
          tx,
        );
        await auditService.record(
          {
            accountId: managerId,
            action: 'RESOLVE',
            entityType: 'BANK_TRANSACTION',
            entityId: id,
            oldValues: current,
            newValues: updated,
            ipAddress: ip,
          },
          tx,
        );
        notifications = await notificationService.create(
          [
            {
              accountId: member.id,
              type: 'PAYMENT',
              title: 'Nạp ví thành công',
              message: `Ví của bạn đã được cộng ${amount.toLocaleString('vi-VN')}đ từ giao dịch chuyển khoản được đối soát.`,
              referenceType: 'BANK_TRANSACTION',
              referenceId: id,
              dedupKey: `bank-resolved:${id}`,
              sendEmail: true,
            },
          ],
          tx,
        );
        return updated;
      }),
    );
    notificationService.sendEmailsAfterCommit(notifications);
    return toBankTransactionResponse(row);
  };

  ignore = async (managerId: string, id: string, body: IgnoreBankTransactionBody, ip?: string) => {
    const row = await runTransaction(async (tx) => {
      await lockRows(tx, { bankTransactions: [id] });
      const current = await bankTransactionRepository.findById(id, tx);
      if (!current) throw notFound();
      if (current.status !== 'UNMATCHED') throw alreadyHandled();

      const updated = await bankTransactionRepository.handle(
        id,
        { status: 'IGNORED', handledById: managerId, handledAt: new Date(), note: body.note },
        tx,
      );
      await auditService.record(
        {
          accountId: managerId,
          action: 'IGNORE',
          entityType: 'BANK_TRANSACTION',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );
      return updated;
    });
    return toBankTransactionResponse(row);
  };

  reconcile = async ({ from, to }: ReconciliationQuery): Promise<{ days: ReconciliationDay[] }> => {
    if (!sepayApi.isConfigured()) throw upstreamUnavailable();

    const sepayRows: SepayTransaction[] = [];
    try {
      for await (const rows of sepayApi.incomingPages({ from, to })) sepayRows.push(...rows);
    } catch (err) {
      if (err instanceof SepayUnavailableError) throw upstreamUnavailable();
      throw err;
    }
    const systemRows = await bankTransactionRepository.findForReconciliation(env.SEPAY_BANK_ACCOUNT!, from, to);
    const recorded = new Set(systemRows.map(({ referenceCode }) => referenceCode).filter(Boolean));

    return {
      days: eachDay(from, to).map((date) => {
        const sepay = sepayRows.filter((row) => row.transaction_date.startsWith(date));
        const system = systemRows.filter((row) => todayInCenter(row.transactionDate) === date);
        const sepayTotal = { count: sepay.length, amount: sepay.reduce((sum, row) => sum + row.amount_in, 0) };
        const systemTotal = {
          count: system.length,
          amount: system.reduce((sum, row) => sum + Number(row.amount), 0),
        };
        return {
          date,
          sepay: sepayTotal,
          system: systemTotal,
          matched: sepayTotal.count === systemTotal.count && sepayTotal.amount === systemTotal.amount,
          missingReferenceCodes: sepay
            .map((row) => row.reference_number)
            .filter((reference): reference is string => !!reference && !recorded.has(reference)),
        };
      }),
    };
  };
}

export default new BankTransactionService();
