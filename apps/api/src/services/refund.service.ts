import type { ItemSnapshotBase } from '@sports-center/shared';

import type { Prisma } from '~/generated/prisma/client';
import orderRepository from '~/repositories/order.repository';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import walletService from '~/services/wallet.service';
import { idempotencyKey } from '~/utils/idempotency';

export interface RefundItemInput {
  orderItemId: string;
  reason: string;
  createdById?: string;
}

const skipped = { refunded: 0, notifications: [] as CreatedNotification[] };

class RefundService {
  refundItem = async (tx: Prisma.TransactionClient, input: RefundItemInput) => {
    const item = await orderRepository.findItemForRefund(input.orderItemId, tx);
    if (!item) throw new Error(`Order item ${input.orderItemId} not found`);

    const { order } = item;
    const accountId = order.accountId;
    const amount = Number(item.totalAmount);
    if (!accountId || item.type === 'MEMBERSHIP' || amount === 0 || item.refundedAt) return skipped;

    const ledger = await walletService.refund(tx, {
      accountId,
      orderId: order.id,
      orderItemId: item.id,
      amount,
      idempotencyKey: idempotencyKey.refund(item.id),
      createdById: input.createdById,
      description: input.reason,
    });

    await orderRepository.markRefunded(tx, item.id, ledger!.createdAt);

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
