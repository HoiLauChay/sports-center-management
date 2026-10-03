import { ERROR_CODE, type CheckoutBody, type CheckoutQuoteBody } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { toQuoteResponse } from '~/mappers/checkout.mapper';
import { toOrderResponse } from '~/mappers/order.mapper';
import orderRepository from '~/repositories/order.repository';
import walletRepository from '~/repositories/wallet.repository';
import { ErrorWithStatus } from '~/rules/error';
import { commitOrder } from '~/services/checkout/commitOrder';
import { buildContext } from '~/services/checkout/context';
import { lineHandlers } from '~/services/checkout/lines';
import { prepareOrder } from '~/services/checkout/prepareOrder';
import type { CheckoutContext, PreparedOrder } from '~/services/checkout/types';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import { hashRequest, idempotencyKey, withIdempotency } from '~/utils/idempotency';
import { retryOnDuplicateCode } from '~/utils/paymentCode';
import { lockRows, runTransaction, withScheduleLock } from '~/utils/transaction';

interface Actor {
  id: string;
  role: Role;
}

const unique = (ids: (string | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))];

const lockCheckout = async (tx: Prisma.TransactionClient, actor: Actor, body: CheckoutBody) => {
  const buyerId =
    actor.role === 'MEMBER' ? actor.id : body.buyer && 'accountId' in body.buyer ? body.buyer.accountId : undefined;
  const handlers = body.items.map((input) => ({ input, handler: lineHandlers[input.type] }));
  const targets = handlers.map(({ input, handler }) => handler?.lockTargets(input) ?? {});

  if (handlers.some(({ handler }) => handler?.needsScheduleLock)) await withScheduleLock(tx);
  await lockRows(tx, {
    systemSettings: 'share',
    accounts: unique([buyerId]),
    memberProfiles: unique([buyerId]),
    classes: unique(targets.flatMap((target) => target.classes ?? [])),
    facilities: unique(targets.flatMap((target) => target.facilities ?? [])),
    memberMemberships: unique(targets.flatMap((target) => target.memberMemberships ?? [])),
  });
};

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
      prepareOrder(prisma, ctx, body.items, body.couponCode),
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
              await lockCheckout(tx, actor, body);
              const ctx = await buildContext(tx, actor, body.buyer);
              const prepared = await prepareOrder(tx, ctx, body.items, body.couponCode);

              if (!prepared.valid) {
                const linesValid = prepared.lines.every(({ result }) => result.ok);
                throw await (linesValid
                  ? rejectQuote(tx, ctx, prepared, 'COUPON_INVALID', 'Mã giảm giá không hợp lệ')
                  : rejectQuote(tx, ctx, prepared, 'CART_ITEM_INVALID', 'Có dòng trong đơn không hợp lệ'));
              }
              if (prepared.total !== body.expectedTotal) {
                throw await rejectQuote(
                  tx,
                  ctx,
                  prepared,
                  'PRICE_CHANGED',
                  'Tổng tiền đã thay đổi, vui lòng xem lại đơn',
                );
              }

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
}

export default new CheckoutService();
