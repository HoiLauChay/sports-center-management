import { ERROR_CODE, type CreateTopUpBody, type ListMyInvoicesQuery } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toInvoiceResponse } from '~/mappers/invoice.mapper';
import accountRepository from '~/repositories/account.repository';
import invoiceRepository from '~/repositories/invoice.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import type { InvoiceSettler } from '~/services/bankTransaction.service';
import notificationService from '~/services/notification.service';
import walletService from '~/services/wallet.service';
import { idempotencyKey } from '~/utils/idempotency';
import { toPage } from '~/utils/pagination';
import { paymentCode, retryOnDuplicateCode } from '~/utils/paymentCode';
import { lockRows, runTransaction } from '~/utils/transaction';

const MAX_PENDING_TOP_UPS = 3;

interface Actor {
  id: string;
  role: Role;
}

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy hóa đơn' });

const invalidField = (path: string, message: string) =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path, message }],
  });

class InvoiceService {
  createTopUp = async (actor: Actor, body: CreateTopUpBody) => {
    const accountId = actor.role === 'MEMBER' ? actor.id : body.accountId;
    if (!accountId) throw invalidField('body.accountId', 'Vui lòng chọn thành viên');

    const invoice = await retryOnDuplicateCode('payment_code_key', () =>
      runTransaction(async (tx) => {
        await lockRows(tx, { systemSettings: 'share', accounts: [accountId] });

        if (actor.role !== 'MEMBER' && !(await accountRepository.findById(accountId, 'MEMBER', tx))) {
          throw invalidField('body.accountId', 'Thành viên không tồn tại');
        }

        const settings = await settingRepository.get(tx);
        const minAmount = Number(settings.topUpMinAmount);
        if (body.amount < minAmount) {
          throw invalidField('body.amount', `Số tiền nạp tối thiểu là ${minAmount.toLocaleString('vi-VN')}đ`);
        }

        const now = new Date();
        if ((await invoiceRepository.countPendingTopUps(accountId, now, tx)) >= MAX_PENDING_TOP_UPS) {
          throw new ErrorWithStatus({
            status: HTTP_STATUS.CONFLICT,
            code: ERROR_CODE.TOO_MANY_PENDING_TOP_UPS,
            message: `Mỗi thành viên chỉ có tối đa ${MAX_PENDING_TOP_UPS} hóa đơn nạp ví đang chờ thanh toán`,
          });
        }

        return invoiceRepository.create(
          {
            paymentCode: paymentCode.generate(),
            purpose: 'WALLET_TOP_UP',
            accountId,
            amount: body.amount,
            expiresAt: new Date(now.getTime() + settings.invoiceExpiryMinutes * 60_000),
            createdById: actor.id,
          },
          tx,
        );
      }),
    );
    return toInvoiceResponse(invoice);
  };

  settleTopUp: InvoiceSettler = async (tx: Prisma.TransactionClient, { invoice, bankTransactionId }) => {
    const accountId = invoice.accountId!;
    await lockRows(tx, { accounts: [accountId], memberProfiles: [accountId], invoices: [invoice.id] });

    const current = await invoiceRepository.findById(invoice.id, tx);
    if (!current || current.status === 'PAID') return null;

    const amount = Number(current.amount);
    await walletService.credit(tx, {
      accountId,
      amount,
      idempotencyKey: idempotencyKey.sepay(bankTransactionId),
      method: 'TRANSFER',
      bankTransactionId,
      description: `Nạp ví qua hóa đơn ${current.paymentCode}`,
    });
    await invoiceRepository.markPaid(invoice.id, bankTransactionId, tx);

    const notifications = await notificationService.create(
      [
        {
          accountId,
          type: 'PAYMENT',
          title: 'Nạp ví thành công',
          message: `Ví của bạn đã được cộng ${amount.toLocaleString('vi-VN')}đ từ hóa đơn ${current.paymentCode}.`,
          referenceType: 'INVOICE',
          referenceId: invoice.id,
          dedupKey: `invoice-paid:${invoice.id}`,
          sendEmail: true,
        },
      ],
      tx,
    );
    return { matched: true, notifications };
  };

  cancel = async (id: string) => {
    const invoice = await runTransaction(async (tx) => {
      await lockRows(tx, { invoices: [id] });
      const current = await invoiceRepository.findById(id, tx);
      if (!current) throw notFound();
      if (current.purpose !== 'COUNTER_ORDER' || current.status !== 'PENDING') {
        throw new ErrorWithStatus({
          status: HTTP_STATUS.CONFLICT,
          code: ERROR_CODE.CONFLICT,
          message: 'Chỉ hủy được hóa đơn quầy đang chờ thanh toán',
        });
      }
      return invoiceRepository.cancel(id, tx);
    });
    return toInvoiceResponse(invoice);
  };

  get = async (viewer: Actor, id: string) => {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice || (viewer.role === 'MEMBER' && invoice.accountId !== viewer.id)) throw notFound();
    return toInvoiceResponse(invoice);
  };

  listMine = async (accountId: string, query: ListMyInvoicesQuery) => {
    const [rows, total] = await invoiceRepository.findPage(accountId, query);
    return toPage(rows.map(toInvoiceResponse), total, query);
  };
}

export default new InvoiceService();
