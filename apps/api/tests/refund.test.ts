import type { OrderStatus } from '@sports-center/shared';
import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import type { OrderItemType } from '~/generated/prisma/client';
import { toOrderResponse } from '~/mappers/order.mapper';
import orderRepository from '~/repositories/order.repository';
import refundService, { type RefundItemInput } from '~/services/refund.service';
import { lockRows, runTransaction } from '~/utils/transaction';
import { resetDatabase } from './helpers/db';
import { createAccount } from './helpers/http';
import { expectWalletConsistent } from './helpers/wallet';

beforeEach(resetDatabase);

let orderSeq = 0;

const createOrder = async (
  accountId: string | null,
  lines: { type: OrderItemType; total: number }[],
  createdById?: string,
) => {
  orderSeq += 1;
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  return prisma.order.create({
    data: {
      orderNumber: `DH261003TEST${String(orderSeq).padStart(2, '0')}`,
      idempotencyKey: `test:order:${orderSeq}`,
      accountId,
      createdById,
      guestName: accountId ? null : 'Khách A',
      guestPhone: accountId ? null : '0901234567',
      receiptSnapshot: { schema_version: 1 },
      subtotal: total,
      totalAmount: total,
      paymentMethod: accountId ? 'WALLET' : 'CASH',
      items: {
        create: lines.map(({ type, total: lineTotal }, index) => ({
          lineNumber: index + 1,
          type,
          itemSnapshot: { schema_version: 1, title: `Dòng ${index + 1}`, startAt: null, endAt: null, discountPct: 0 },
          subtotal: lineTotal,
          totalAmount: lineTotal,
        })),
      },
    },
    include: { items: { orderBy: { lineNumber: 'asc' } } },
  });
};

const refund = (accountId: string | null, orderId: string, input: RefundItemInput) =>
  runTransaction(async (tx) => {
    const owner = accountId ? [accountId] : [];
    await lockRows(tx, { accounts: owner, memberProfiles: owner, orders: [orderId], orderItems: [input.orderItemId] });
    return refundService.refundItem(tx, input);
  });

const orderState = async (id: string) => toOrderResponse((await orderRepository.findById(id))!);

const ordersWithStatus = async (status: OrderStatus) =>
  (await orderRepository.findPage({ page: 1, limit: 20, status }))[0].map(({ orderNumber }) => orderNumber);

describe('refund an order line', () => {
  test('a line is refunded in full and only once, even when asked again at the same time', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const order = await createOrder(member.id, [{ type: 'COURSE_ENROLLMENT', total: 300_000 }]);
    const input = { orderItemId: order.items[0]!.id, reason: 'Lớp bị hủy' };

    const results = await Promise.all([1, 2, 3].map(() => refund(member.id, order.id, input)));
    expect(results.map(({ refunded }) => refunded).sort()).toEqual([0, 0, 300_000]);
    expect((await refund(member.id, order.id, input)).refunded).toBe(0);

    const state = await orderState(order.id);
    expect(state.status).toBe('REFUNDED');
    expect(state.items[0]!.refundedAt).toBe(state.refunds[0]!.createdAt);
    expect(state.refunds.map(({ amount }) => amount)).toEqual([300_000]);
    expect(await ordersWithStatus('REFUNDED')).toEqual([order.orderNumber]);
    expect(await ordersWithStatus('PAID')).toEqual([]);
    expect(await prisma.notification.count({ where: { accountId: member.id, sendEmail: true } })).toBe(1);
    expect(await expectWalletConsistent(member.id)).toBe(300_000);
  });

  test('refunding some lines leaves the order partially refunded; membership lines are never refunded', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const order = await createOrder(member.id, [
      { type: 'FACILITY_BOOKING', total: 200_000 },
      { type: 'COURSE_ENROLLMENT', total: 100_000 },
      { type: 'MEMBERSHIP', total: 500_000 },
    ]);
    const [booking, enrollment, membership] = order.items;

    const results = await Promise.all(
      [booking!, enrollment!, membership!].map(({ id }) =>
        refund(member.id, order.id, { orderItemId: id, reason: 'x' }),
      ),
    );
    expect(results.map(({ refunded }) => refunded)).toEqual([200_000, 100_000, 0]);

    const state = await orderState(order.id);
    expect(state.status).toBe('PARTIALLY_REFUNDED');
    expect(state.items.map(({ refundedAt }) => refundedAt !== null)).toEqual([true, true, false]);
    expect(await ordersWithStatus('PARTIALLY_REFUNDED')).toEqual([order.orderNumber]);
    expect(await expectWalletConsistent(member.id)).toBe(300_000);
  });

  test('guest orders and free lines are never refunded', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const guestOrder = await createOrder(null, [{ type: 'FACILITY_BOOKING', total: 200_000 }], receptionist.id);
    const freeOrder = await createOrder(member.id, [{ type: 'FACILITY_BOOKING', total: 0 }]);

    const guest = await refund(null, guestOrder.id, { orderItemId: guestOrder.items[0]!.id, reason: 'Bảo trì' });
    const free = await refund(member.id, freeOrder.id, { orderItemId: freeOrder.items[0]!.id, reason: 'Hủy' });

    expect([guest.refunded, free.refunded]).toEqual([0, 0]);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect((await orderState(guestOrder.id)).status).toBe('PAID');
    expect((await ordersWithStatus('PAID')).sort()).toEqual([guestOrder.orderNumber, freeOrder.orderNumber].sort());
  });
});
