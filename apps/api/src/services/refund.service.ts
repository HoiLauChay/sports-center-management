import type { ItemSnapshotBase } from '@sports-center/shared';

import type { OrderStatus, Prisma } from '~/generated/prisma/client';
import orderRepository from '~/repositories/order.repository';
import walletRepository from '~/repositories/wallet.repository';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import walletService from '~/services/wallet.service';

export interface RefundComponentInput {
  orderItemId: string;
  key: string;
  amount: number;
  reason: string;
  createdById?: string;
}

const statusAfter = (total: number, refunded: number): OrderStatus =>
  refunded === 0 ? 'PAID' : refunded < total ? 'PARTIALLY_REFUNDED' : 'REFUNDED';

const skipped = { refunded: 0, notifications: [] as CreatedNotification[] };

class RefundService {
  refundComponent = async (tx: Prisma.TransactionClient, input: RefundComponentInput) => {
    const item = await orderRepository.findItemForRefund(input.orderItemId, tx);
    if (!item) throw new Error(`Order item ${input.orderItemId} not found`);

    const { order } = item;
    const accountId = order.accountId;
    const lineTotal = Number(item.totalAmount);
    if (!accountId || item.type === 'MEMBERSHIP' || lineTotal === 0) return skipped;
    if (await walletRepository.findTransactionByKey(input.key, tx)) return skipped;

    const amount = Math.min(input.amount, lineTotal - Number(item.refundedAmount));
    if (amount <= 0) return skipped;

    const ledger = await walletService.refund(tx, {
      accountId,
      orderId: order.id,
      orderItemId: item.id,
      amount,
      idempotencyKey: input.key,
      createdById: input.createdById,
      description: input.reason,
    });

    const orderRefunded = Number(order.refundedAmount) + amount;
    await orderRepository.addRefund(tx, {
      orderId: order.id,
      orderItemId: item.id,
      amount,
      status: statusAfter(Number(order.totalAmount), orderRefunded),
    });

    const { title } = item.itemSnapshot as unknown as ItemSnapshotBase;
    const notifications = await notificationService.create(
      [
        {
          accountId,
          type: 'PAYMENT',
          title: 'Hoàn tiền về ví',
          message: `Ví của bạn được hoàn ${amount.toLocaleString('vi-VN')}đ cho "${title}" (đơn ${order.orderNumber}). Lý do: ${input.reason}.`,
          referenceType: 'ORDER',
          referenceId: order.id,
          dedupKey: `refund:${ledger!.id}`,
          sendEmail: true,
        },
      ],
      tx,
    );
    return { refunded: amount, notifications };
  };
}

export default new RefundService();
