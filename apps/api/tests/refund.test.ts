import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import type { OrderItemType } from '~/generated/prisma/client';
import refundService, { type RefundComponentInput } from '~/services/refund.service';
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

const refund = (accountId: string | null, orderId: string, input: RefundComponentInput) =>
  runTransaction(async (tx) => {
    const owner = accountId ? [accountId] : [];
    await lockRows(tx, { accounts: owner, memberProfiles: owner, orders: [orderId], orderItems: [input.orderItemId] });
    return refundService.refundComponent(tx, input);
  });

const orderState = (id: string) =>
  prisma.order.findUniqueOrThrow({
    where: { id },
    select: {
      status: true,
      refundedAmount: true,
      items: { select: { refundedAmount: true }, orderBy: { lineNumber: 'asc' } },
    },
  });

describe('refund a component', () => {
  test('the same component refunded twice is credited once, and never above what the line paid', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const order = await createOrder(member.id, [{ type: 'FACILITY_PACKAGE', total: 300_000 }]);
    const line = order.items[0]!;
    const input = { orderItemId: line.id, key: 'refund:booking:b1', amount: 100_000, reason: 'Hủy booking đúng hạn' };

    const results = await Promise.all([1, 2, 3].map(() => refund(member.id, order.id, input)));
    expect(results.map(({ refunded }) => refunded).sort()).toEqual([0, 0, 100_000]);

    const more = await refund(member.id, order.id, { ...input, key: 'refund:booking:b2', amount: 250_000 });
    expect(more.refunded).toBe(200_000);
    expect((await refund(member.id, order.id, { ...input, key: 'refund:booking:b3' })).refunded).toBe(0);

    const state = await orderState(order.id);
    expect([state.status, Number(state.refundedAmount)]).toEqual(['REFUNDED', 300_000]);
    expect(await prisma.walletTransaction.count({ where: { type: 'REFUND' } })).toBe(2);
    expect(await prisma.notification.count({ where: { accountId: member.id, sendEmail: true } })).toBe(2);
    expect(await expectWalletConsistent(member.id)).toBe(300_000);
  });

  test('refunds of different lines at the same time keep the order totals right', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const order = await createOrder(member.id, [
      { type: 'FACILITY_BOOKING', total: 200_000 },
      { type: 'FACILITY_BOOKING', total: 100_000 },
      { type: 'MEMBERSHIP', total: 500_000 },
    ]);
    const [first, second, membership] = order.items;

    const results = await Promise.all([
      refund(member.id, order.id, {
        orderItemId: first!.id,
        key: 'refund:booking:a',
        amount: 200_000,
        reason: 'Bảo trì',
      }),
      refund(member.id, order.id, {
        orderItemId: second!.id,
        key: 'refund:booking:b',
        amount: 100_000,
        reason: 'Bảo trì',
      }),
      refund(member.id, order.id, {
        orderItemId: membership!.id,
        key: 'refund:membership',
        amount: 500_000,
        reason: 'x',
      }),
    ]);
    expect(results.map(({ refunded }) => refunded)).toEqual([200_000, 100_000, 0]);

    const state = await orderState(order.id);
    expect(state.status).toBe('PARTIALLY_REFUNDED');
    expect(state.items.map(({ refundedAmount }) => Number(refundedAmount))).toEqual([200_000, 100_000, 0]);
    expect(Number(state.refundedAmount)).toBe(300_000);
    expect(await expectWalletConsistent(member.id)).toBe(300_000);
  });

  test('guest orders and free lines are never refunded', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const guestOrder = await createOrder(null, [{ type: 'FACILITY_BOOKING', total: 200_000 }], receptionist.id);
    const freeOrder = await createOrder(member.id, [{ type: 'FACILITY_BOOKING', total: 0 }]);

    const guest = await refund(null, guestOrder.id, {
      orderItemId: guestOrder.items[0]!.id,
      key: 'refund:booking:guest',
      amount: 200_000,
      reason: 'Bảo trì',
    });
    const free = await refund(member.id, freeOrder.id, {
      orderItemId: freeOrder.items[0]!.id,
      key: 'refund:booking:free',
      amount: 0,
      reason: 'Hủy',
    });

    expect([guest.refunded, free.refunded]).toEqual([0, 0]);
    expect(await prisma.walletTransaction.count()).toBe(0);
    expect((await orderState(guestOrder.id)).status).toBe('PAID');
  });
});
