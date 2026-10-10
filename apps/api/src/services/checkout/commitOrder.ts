import { RECEIPT_ISSUER } from '~/constants/center';
import type { Prisma } from '~/generated/prisma/client';
import accountRepository from '~/repositories/account.repository';
import orderRepository from '~/repositories/order.repository';
import { lineHandlers } from '~/services/checkout/lines';
import type { CheckoutContext, PreparedOrder } from '~/services/checkout/types';
import notificationService from '~/services/notification.service';
import walletService from '~/services/wallet.service';
import { orderNumber } from '~/utils/paymentCode';

const SCHEMA_VERSION = 1;

export interface OrderPayment {
  method: 'WALLET' | 'CASH' | 'CARD' | 'TRANSFER';
  idempotencyKey: string;
  requestHash: string | null;
}

const buyerSnapshot = async (tx: Prisma.TransactionClient, ctx: CheckoutContext) => {
  if (ctx.buyer.kind === 'GUEST') return { guest: { name: ctx.buyer.name, phone: ctx.buyer.phone } };
  const account = (await accountRepository.findById(ctx.buyer.accountId, 'MEMBER', tx))!;
  return {
    accountId: account.id,
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
    address: account.address,
  };
};

export const commitOrder = async (
  tx: Prisma.TransactionClient,
  ctx: CheckoutContext,
  prepared: PreparedOrder,
  payment: OrderPayment,
) => {
  const number = orderNumber.generate(ctx.now);
  const memberId = ctx.buyer.kind === 'MEMBER' ? ctx.buyer.accountId : null;
  const createdBy =
    ctx.actor.role === 'MEMBER'
      ? null
      : { id: ctx.actor.id, fullName: (await accountRepository.findById(ctx.actor.id, undefined, tx))!.fullName };

  const lines = prepared.lines.map(({ lineNumber, input, result, couponDiscount, couponId }) => {
    if (!result.ok) throw new Error(`commitOrder called with invalid line ${lineNumber}`);
    return {
      lineNumber,
      input,
      result,
      couponDiscount,
      couponId,
      total: result.subtotal - result.membershipDiscount - couponDiscount,
    };
  });
  const coupons = prepared.coupons.filter(({ applied }) => applied);

  const order = await orderRepository.create(
    {
      orderNumber: number,
      idempotencyKey: payment.idempotencyKey,
      requestHash: payment.requestHash,
      accountId: memberId,
      guestName: ctx.buyer.kind === 'GUEST' ? ctx.buyer.name : null,
      guestPhone: ctx.buyer.kind === 'GUEST' ? ctx.buyer.phone : null,
      createdById: createdBy?.id,
      receiptSnapshot: {
        schema_version: SCHEMA_VERSION,
        orderNumber: number,
        issuedAt: ctx.now.toISOString(),
        issuer: RECEIPT_ISSUER,
        buyer: await buyerSnapshot(tx, ctx),
        createdBy,
        paymentMethod: payment.method,
        membership: prepared.membershipName ? { packageName: prepared.membershipName } : null,
        coupons: coupons.map(({ code, name, discount }) => ({ code, name, discount })),
      },
      subtotal: prepared.subtotal,
      membershipDiscountAmount: prepared.membershipDiscount,
      couponDiscountAmount: prepared.couponDiscount,
      totalAmount: prepared.total,
      paymentMethod: payment.method,
      items: {
        create: lines.map(({ lineNumber, input, result, couponDiscount, couponId, total }) => ({
          lineNumber,
          type: input.type,
          itemSnapshot: { schema_version: SCHEMA_VERSION, ...result.snapshot } as Prisma.InputJsonObject,
          subtotal: result.subtotal,
          membershipDiscountAmount: result.membershipDiscount,
          couponDiscountAmount: couponDiscount,
          couponId,
          totalAmount: total,
        })),
      },
    },
    tx,
  );

  for (const { lineNumber, input, result, total } of lines) {
    const itemId = order.items.find((item) => item.lineNumber === lineNumber)!.id;
    await lineHandlers[input.type]!.fulfill(tx, ctx, { lineNumber, total, data: result.data }, itemId);
  }

  if (payment.method === 'WALLET' && memberId) {
    await walletService.pay(tx, {
      accountId: memberId,
      orderId: order.id,
      amount: prepared.total,
      description: `Thanh toán đơn ${number}`,
    });
  }

  const notifications = memberId
    ? await notificationService.create(
        [
          {
            accountId: memberId,
            type: 'PAYMENT',
            title: 'Thanh toán thành công',
            message: `Đơn ${number} đã được thanh toán ${prepared.total.toLocaleString('vi-VN')}đ.`,
            referenceType: 'ORDER',
            referenceId: order.id,
            dedupKey: `order-paid:${order.id}`,
            sendEmail: true,
          },
        ],
        tx,
      )
    : [];

  return { orderId: order.id, notifications };
};
