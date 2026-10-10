import {
  ERROR_CODE,
  type CheckoutBody,
  type CheckoutItemInput,
  type CheckoutQuoteBody,
  type CounterInvoiceBody,
} from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toQuoteResponse } from '~/mappers/checkout.mapper';
import { toInvoiceResponse } from '~/mappers/invoice.mapper';
import { toOrderResponse } from '~/mappers/order.mapper';
import accountRepository from '~/repositories/account.repository';
import couponRepository from '~/repositories/coupon.repository';
import invoiceRepository from '~/repositories/invoice.repository';
import orderRepository from '~/repositories/order.repository';
import settingRepository from '~/repositories/setting.repository';
import walletRepository from '~/repositories/wallet.repository';
import { ErrorWithStatus } from '~/rules/error';
import type { InvoiceSettler } from '~/services/bankTransaction.service';
import { commitOrder } from '~/services/checkout/commitOrder';
import { buildContext } from '~/services/checkout/context';
import { lineHandlers } from '~/services/checkout/lines';
import { prepareOrder } from '~/services/checkout/prepareOrder';
import type { CheckoutContext, CounterOrderPayload, PreparedOrder } from '~/services/checkout/types';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import walletService from '~/services/wallet.service';
import { hashRequest, idempotencyKey, withIdempotency } from '~/utils/idempotency';
import { paymentCode, retryOnDuplicateCode } from '~/utils/paymentCode';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

interface Actor {
  id: string;
  role: Role;
}

const unique = (ids: (string | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))];

const rejectQuote = async (
  tx: Prisma.TransactionClient,
  ctx: CheckoutContext,
  prepared: PreparedOrder,
  code: 'CART_ITEM_INVALID' | 'COUPON_INVALID' | 'PRICE_CHANGED',
  message: string,
) => {
  const balance = ctx.buyer.kind === 'MEMBER' ? await walletRepository.readBalance(ctx.buyer.accountId, tx) : null;
  return new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE[code],
    message,
    meta: { quote: toQuoteResponse(prepared, balance) },
  });
};

const MAX_PENDING_INVOICES = 3;

interface LockScope {
  buyerId?: string;
  items: CheckoutItemInput[];
  couponIds?: string[];
  invoiceId?: string;
}

const lockCheckout = async (tx: Prisma.TransactionClient, { buyerId, items, couponIds = [], invoiceId }: LockScope) => {
  const handlers = items.map((input) => ({ input, handler: lineHandlers[input.type] }));
  const targets = handlers.map(({ input, handler }) => handler?.lockTargets(input) ?? {});

  if (handlers.some(({ handler }) => handler?.needsScheduleLock)) await withScheduleLock(tx);
  await lockRows(tx, {
    systemSettings: 'share',
    accounts: unique([buyerId]),
    memberProfiles: unique([buyerId]),
    classes: unique(targets.flatMap((target) => target.classes ?? [])),
    facilities: unique(targets.flatMap((target) => target.facilities ?? [])),
    memberMemberships: unique(targets.flatMap((target) => target.memberMemberships ?? [])),
    coupons: unique(couponIds),
    invoices: unique([invoiceId]),
  });
};

const tooManyInvoices = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.CONFLICT,
    code: ERROR_CODE.TOO_MANY_PENDING_INVOICES,
    message: `Mỗi người mua chỉ có tối đa ${MAX_PENDING_INVOICES} hóa đơn quầy đang chờ thanh toán`,
  });

const freeOrder = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [{ path: 'body.expectedTotal', message: 'Đơn 0đ thanh toán bằng tiền mặt, không cần chuyển khoản' }],
  });

const unavailableReason = async (tx: Prisma.TransactionClient, ctx: CheckoutContext, prepared: PreparedOrder) => {
  if (ctx.buyer.kind === 'MEMBER') {
    const account = await accountRepository.findById(ctx.buyer.accountId, 'MEMBER', tx);
    if (account?.status !== 'ACTIVE') return 'Tài khoản người mua không còn hoạt động';
  }
  for (const { lineNumber, input, result, couponDiscount } of prepared.lines) {
    if (!result.ok) return 'Đơn có dòng không hợp lệ';
    const total = result.subtotal - result.membershipDiscount - couponDiscount;
    const error = await lineHandlers[input.type]!.verify(tx, ctx, { lineNumber, total, data: result.data });
    if (error) return error.message;
  }
  return null;
};

const buyerIdOf = (actor: Actor, body: CheckoutQuoteBody) =>
  actor.role === 'MEMBER' ? actor.id : body.buyer && 'accountId' in body.buyer ? body.buyer.accountId : undefined;

const prepareLocked = async (
  tx: Prisma.TransactionClient,
  actor: Actor,
  body: CheckoutQuoteBody & { expectedTotal: number },
) => {
  const couponIds = body.couponCodes?.length ? await couponRepository.findIdsByCodes(body.couponCodes, tx) : [];
  await lockCheckout(tx, { buyerId: buyerIdOf(actor, body), items: body.items, couponIds });
  const ctx = await buildContext(tx, actor, body.buyer);
  const prepared = await prepareOrder(tx, ctx, body.items, body.couponCodes);

  if (!prepared.valid) {
    const linesValid = prepared.lines.every(({ result }) => result.ok);
    throw await (linesValid
      ? rejectQuote(tx, ctx, prepared, 'COUPON_INVALID', 'Mã giảm giá không hợp lệ')
      : rejectQuote(tx, ctx, prepared, 'CART_ITEM_INVALID', 'Có dòng trong đơn không hợp lệ'));
  }
  if (prepared.total !== body.expectedTotal) {
    throw await rejectQuote(tx, ctx, prepared, 'PRICE_CHANGED', 'Tổng tiền đã thay đổi, vui lòng xem lại đơn');
  }
  return { ctx, prepared };
};

const assertPaymentMethod = (actor: Actor, method: CheckoutBody['paymentMethod']) => {
  const allowed = actor.role === 'MEMBER' ? method === 'WALLET' : method !== 'WALLET';
  if (allowed) return;
  throw new ErrorWithStatus({
    status: HTTP_STATUS.UNPROCESSABLE_ENTITY,
    code: ERROR_CODE.VALIDATION,
    message: 'Dữ liệu không hợp lệ',
    errors: [
      {
        path: 'body.paymentMethod',
        message: actor.role === 'MEMBER' ? 'Thành viên chỉ thanh toán bằng ví' : 'Tại quầy chỉ thu tiền mặt hoặc thẻ',
      },
    ],
  });
};

class CheckoutService {
  quote = async (actor: Actor, body: CheckoutQuoteBody) => {
    const ctx = await buildContext(prisma, actor, body.buyer);
    const [prepared, wallet] = await Promise.all([
      prepareOrder(prisma, ctx, body.items, body.couponCodes),
      ctx.buyer.kind === 'MEMBER' ? walletRepository.findBalance(ctx.buyer.accountId) : null,
    ]);
    return toQuoteResponse(prepared, wallet ? Number(wallet.walletBalance) : null);
  };

  checkout = async (actor: Actor, body: CheckoutBody) => {
    assertPaymentMethod(actor, body.paymentMethod);
    const { idempotencyKey: clientKey, ...payload } = body;
    const requestHash = hashRequest(payload);
    const key =
      actor.role === 'MEMBER'
        ? idempotencyKey.checkout(actor.id, clientKey)
        : idempotencyKey.counter(actor.id, clientKey);
    let notifications: CreatedNotification[] = [];

    const order = await withIdempotency({
      requestHash,
      find: () => orderRepository.findByIdempotencyKey(key),
      execute: () =>
        retryOnDuplicateCode('order_number_key', () =>
          retryOnDuplicateCode('transaction_code_key', () =>
            runTransaction(async (tx) => {
              const { ctx, prepared } = await prepareLocked(tx, actor, body);
              const committed = await commitOrder(tx, ctx, prepared, {
                method: body.paymentMethod,
                idempotencyKey: key,
                requestHash,
              });
              notifications = committed.notifications;
              return (await orderRepository.findById(committed.orderId, tx))!;
            }),
          ),
        ),
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toOrderResponse(order);
  };

  createInvoice = async (actor: Actor, body: CounterInvoiceBody) => {
    const invoice = await retryOnDuplicateCode('payment_code_key', () =>
      runTransaction(async (tx) => {
        const { ctx, prepared } = await prepareLocked(tx, actor, body);
        if (prepared.total === 0) throw freeOrder();

        const holder =
          ctx.buyer.kind === 'MEMBER' ? { accountId: ctx.buyer.accountId } : { guestPhone: ctx.buyer.phone };
        if ((await invoiceRepository.countHeldOrders(holder, ctx.now, tx)) >= MAX_PENDING_INVOICES) {
          throw tooManyInvoices();
        }

        const payload: CounterOrderPayload = { buyer: ctx.buyer, prepared };
        return invoiceRepository.create(
          {
            paymentCode: paymentCode.generate(),
            purpose: 'COUNTER_ORDER',
            accountId: ctx.buyer.kind === 'MEMBER' ? ctx.buyer.accountId : null,
            guestName: ctx.buyer.kind === 'GUEST' ? ctx.buyer.name : null,
            guestPhone: ctx.buyer.kind === 'GUEST' ? ctx.buyer.phone : null,
            amount: prepared.total,
            requestPayload: payload as unknown as Prisma.InputJsonObject,
            expiresAt: new Date(ctx.now.getTime() + ctx.settings.invoiceExpiryMinutes * 60_000),
            createdById: actor.id,
          },
          tx,
        );
      }),
    );
    return toInvoiceResponse(invoice);
  };

  settleCounterOrder: InvoiceSettler = async (tx, { invoice, bankTransactionId }) => {
    const found = await invoiceRepository.findCounterOrder(invoice.id, tx);
    if (!found) return null;
    const { buyer, prepared } = found.requestPayload as unknown as CounterOrderPayload;
    await lockCheckout(tx, {
      buyerId: found.accountId ?? undefined,
      items: prepared.lines.map(({ input }) => input),
      couponIds: prepared.coupons.flatMap(({ id, applied }) => (applied && id ? [id] : [])),
      invoiceId: found.id,
    });

    const current = (await invoiceRepository.findCounterOrder(found.id, tx))!;
    if (current.status === 'PAID' || current.status === 'FAILED') return null;

    const ctx: CheckoutContext = {
      buyer,
      actor: { id: current.createdById, role: 'RECEPTIONIST' },
      now: new Date(),
      settings: await settingRepository.get(tx),
      benefits: null,
      planned: [],
    };
    const reason =
      current.status !== 'PENDING' || current.expiresAt <= ctx.now
        ? 'Hóa đơn đã hết hạn hoặc đã bị hủy'
        : await unavailableReason(tx, ctx, prepared);

    if (!reason) {
      const committed = await commitOrder(tx, ctx, prepared, {
        method: 'TRANSFER',
        idempotencyKey: idempotencyKey.invoice(current.id),
        requestHash: null,
      });
      await invoiceRepository.markPaid(current.id, bankTransactionId, tx, committed.orderId);
      return { matched: true, notifications: committed.notifications };
    }

    await invoiceRepository.markFailed(current.id, bankTransactionId, tx);
    const amount = Number(current.amount);
    const memberId = buyer.kind === 'MEMBER' ? buyer.accountId : null;
    if (memberId) {
      await walletService.credit(tx, {
        accountId: memberId,
        amount,
        idempotencyKey: idempotencyKey.sepay(bankTransactionId),
        method: 'TRANSFER',
        bankTransactionId,
        description: `Hóa đơn ${current.paymentCode} không tạo được đơn, tiền được cộng vào ví`,
      });
    }

    const money = amount.toLocaleString('vi-VN');
    const notifications = await notificationService.create(
      [
        {
          accountId: current.createdById,
          type: 'PAYMENT' as const,
          title: 'Hóa đơn quầy thất bại',
          message: memberId
            ? `Hóa đơn ${current.paymentCode} nhận ${money}đ nhưng không tạo được đơn (${reason}). Tiền đã được cộng vào ví thành viên.`
            : `Hóa đơn ${current.paymentCode} nhận ${money}đ nhưng không tạo được đơn (${reason}). Giao dịch chờ quản lý xử lý.`,
          referenceType: 'INVOICE',
          referenceId: current.id,
          dedupKey: `invoice-failed:${current.id}:${current.createdById}`,
        },
        ...(memberId
          ? [
              {
                accountId: memberId,
                type: 'PAYMENT' as const,
                title: 'Tiền chuyển khoản đã vào ví',
                message: `Hóa đơn ${current.paymentCode} không tạo được đơn (${reason}). ${money}đ đã được cộng vào ví của bạn.`,
                referenceType: 'INVOICE',
                referenceId: current.id,
                dedupKey: `invoice-failed:${current.id}:${memberId}`,
                sendEmail: true,
              },
            ]
          : []),
      ],
      tx,
    );
    return { matched: !!memberId, notifications, note: `hóa đơn ${current.paymentCode} thất bại: ${reason}` };
  };
}

export default new CheckoutService();
