import type { Order, Paginated } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import orderRepository from '~/repositories/order.repository';
import { lineHandlers } from '~/services/checkout/lines';
import { buildPaymentReceipt, buildRefundReceipt } from '~/services/receipt/receipt.view';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readResult, startServer, type Viewer } from './helpers/http';

const FACILITY_ID = '00000000-0000-4000-8000-000000000002';

let server: Server;
let request: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

const unused = () => Promise.reject(new Error('not used'));
const realBookingHandler = lineHandlers.FACILITY_BOOKING;

beforeAll(async () => {
  ({ server, request } = await startServer('/orders'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
  lineHandlers.FACILITY_BOOKING = {
    type: 'FACILITY_BOOKING',
    guestAllowed: true,
    needsScheduleLock: false,
    lockTargets: () => ({}),
    prepare: async (db) => {
      const facility = await db.facility.findUniqueOrThrow({ where: { id: FACILITY_ID } });
      return {
        ok: true,
        subtotal: 240_000,
        membershipDiscount: 0,
        snapshot: {
          title: facility.name,
          startAt: '2026-10-05T11:00:00.000Z',
          endAt: '2026-10-05T12:00:00.000Z',
          discountPct: 0,
        },
        data: null,
      };
    },
    verify: unused,
    fulfill: async () => ({ refId: crypto.randomUUID() }),
  };
});

afterAll(() => {
  lineHandlers.FACILITY_BOOKING = realBookingHandler;
  server.close();
});

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
  await prisma.facility.create({
    data: { id: FACILITY_ID, name: 'Sân cầu lông 2', type: 'COURT', capacityPerSlot: 1, pricePerSlot: 120_000 },
  });
});

const buy = async (member: Viewer, key: string) => {
  await prisma.memberProfile.update({ where: { accountId: member.id }, data: { walletBalance: 240_000 } });
  const response = await checkout('POST', '', member, {
    items: [
      { type: 'FACILITY_BOOKING', facilityId: FACILITY_ID, date: '2026-10-05', startTime: '18:00', endTime: '19:00' },
    ],
    paymentMethod: 'WALLET',
    expectedTotal: 240_000,
    idempotencyKey: key,
  });
  expect(response.status).toBe(201);
  return readResult<Order>(response);
};

const expectPdf = async (response: Response) => {
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/pdf');
  expect(new TextDecoder().decode((await response.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
};

describe('orders and receipts', () => {
  test('the receipt keeps the facility name from the time of purchase', async () => {
    const member = await createAccount('MEMBER', 'member@example.com');
    const order = await buy(member, 'order-key-1');

    await prisma.facility.update({ where: { id: FACILITY_ID }, data: { name: 'Sân A2' } });

    const view = buildPaymentReceipt((await orderRepository.findById(order.id))!);
    expect(view.rows.map(({ title, amount }) => ({ title, amount }))).toEqual([
      { title: 'Sân cầu lông 2', amount: 240_000 },
    ]);
    expect(view.info).toContainEqual(['Trạng thái:', 'Đã thanh toán']);
    expect((await readResult<Order>(await request('GET', `/${order.id}`, member))).items[0]?.snapshot).toMatchObject({
      title: 'Sân cầu lông 2',
    });
    await expectPdf(await request('GET', `/${order.id}/receipt`, member));
  });

  test('a member cannot see or download another member order', async () => {
    const owner = await createAccount('MEMBER', 'owner@example.com');
    const other = await createAccount('MEMBER', 'other@example.com');
    const receptionist = await createAccount('RECEPTIONIST', 'receptionist@example.com');
    const order = await buy(owner, 'order-key-2');
    const refund = await prisma.walletTransaction.create({
      data: {
        accountId: owner.id,
        transactionCode: 'GD261005REFUND01',
        idempotencyKey: `refund:test:${order.id}`,
        type: 'REFUND',
        amount: 240_000,
        balanceAfter: 240_000,
        orderId: order.id,
        orderItemId: order.items[0]!.id,
        description: 'Hủy booking đúng hạn',
      },
    });

    for (const path of [`/${order.id}`, `/${order.id}/receipt`, `/${order.id}/refunds/${refund.id}/receipt`]) {
      expect((await request('GET', path, other)).status).toBe(404);
    }
    const mine = await startServer('/me/orders');
    const otherList = await readResult<Paginated<Order>>(await mine.request('GET', '', other));
    mine.server.close();
    expect(otherList.total).toBe(0);

    const seen = await readResult<Order>(await request('GET', `/${order.id}`, receptionist));
    expect(seen.refunds).toMatchObject([{ id: refund.id, amount: 240_000, reason: 'Hủy booking đúng hạn' }]);
    await expectPdf(await request('GET', `/${order.id}/refunds/${refund.id}/receipt`, owner));

    const view = buildRefundReceipt((await orderRepository.findById(order.id))!, {
      ...refund,
      createdBy: null,
    });
    expect(view).toMatchObject({
      total: { label: 'Số tiền hoàn', amount: 240_000 },
      rows: [{ title: 'Sân cầu lông 2', amount: 240_000 }],
    });
    expect(view.info).toContainEqual(['Thuộc đơn:', order.orderNumber]);

    const otherOrder = await buy(other, 'order-key-3');
    expect((await request('GET', `/${otherOrder.id}/refunds/${refund.id}/receipt`, other)).status).toBe(404);
  });
});
