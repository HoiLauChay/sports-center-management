import type { Order, Paginated, Product, ProductCategory, ProductSale, Quote, ShopReport } from '@sports-center/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import type { Server } from 'node:http';

import { prisma } from '~/configs/db';
import type { Role } from '~/generated/prisma/client';
import shopService from '~/services/shop.service';
import { todayInCenter } from '~/utils/time';
import { resetDatabase } from './helpers/db';
import { buildFetcher, createAccount, readCode, readResult, startServer } from './helpers/http';
import { expectOrderConsistent } from './helpers/order';
import { expectWalletConsistent, seedBalance } from './helpers/wallet';

let server: Server;
let shop: Awaited<ReturnType<typeof startServer>>['request'];
let checkout: ReturnType<typeof buildFetcher>;

beforeAll(async () => {
  ({ server, request: shop } = await startServer('/shop'));
  checkout = buildFetcher(`http://localhost:${(server.address() as { port: number }).port}/api/v1/checkout`);
});

afterAll(() => server.close());

beforeEach(async () => {
  await resetDatabase();
  await prisma.systemSetting.create({ data: {} });
});

const setup = async () => {
  const manager = await createAccount('MANAGER', 'manager@example.com');
  const receptionist = await createAccount('RECEPTIONIST', 'reception@example.com');
  const member = await createAccount('MEMBER', 'member@example.com');
  const category = await readResult<ProductCategory>(await shop('POST', '/categories', manager, { name: 'Đồ uống' }));
  const water = await readResult<Product>(
    await shop('POST', '/products', manager, {
      sku: ' aqua-500 ',
      name: 'Nước suối 500ml',
      categoryId: category.id,
      price: 10_000,
      initialStock: 5,
    }),
  );
  const shuttles = await readResult<Product>(
    await shop('POST', '/products', manager, {
      sku: 'BAD-SHUTTLE',
      name: 'Ống cầu lông (12 quả)',
      categoryId: category.id,
      price: 30_000,
      initialStock: 10,
      lowStockThreshold: 2,
    }),
  );
  return { manager, receptionist, member, category, water, shuttles };
};

const line = (productId: string, quantity: number) => ({ type: 'PRODUCT_SALE', productId, quantity });

const buy = (viewer: { id: string; role: Role }, items: unknown[], expectedTotal: number, key = 'key-12345678') =>
  checkout('POST', '/', viewer, { items, paymentMethod: 'WALLET', expectedTotal, idempotencyKey: key });

const stockOf = async (id: string) => (await prisma.product.findUniqueOrThrow({ where: { id } })).stock;

describe('shop catalog', () => {
  test('managers own the catalog; SKUs are normalised and unique', async () => {
    const { manager, member, category, water, shuttles } = await setup();

    expect(water).toMatchObject({ sku: 'AQUA-500', stock: 5, lowStock: true });
    expect(shuttles).toMatchObject({ stock: 10, lowStock: false });

    expect((await shop('POST', '/categories', member, { name: 'X' })).status).toBe(403);
    const duplicate = await shop('POST', '/products', manager, {
      sku: 'AQUA-500',
      name: 'Khác',
      categoryId: category.id,
      price: 1,
    });
    expect(duplicate.status).toBe(409);

    const negativeStock = await shop('POST', '/products', manager, {
      sku: 'BAD-GRIP',
      name: 'Quấn cán',
      categoryId: category.id,
      price: 1,
      initialStock: -3,
    });
    expect(negativeStock.status).toBe(422);

    // A member only sees active products.
    await shop('PATCH', `/products/${shuttles.id}`, manager, { isActive: false });
    const visible = await readResult<Paginated<Product>>(await shop('GET', '/products', member));
    expect(visible.items.map(({ id }) => id)).toEqual([water.id]);
    expect((await shop('GET', `/products/${shuttles.id}`, member)).status).toBe(404);

    // A category with products cannot be deleted.
    expect(await readCode(await shop('DELETE', `/categories/${category.id}`, manager))).toBe('HAS_DEPENDENCIES');
  });

  test('stock adjustments write the ledger and never go below zero', async () => {
    const { manager, water } = await setup();

    await shop('POST', `/products/${water.id}/stock`, manager, { reason: 'IMPORT', delta: 20, note: 'Nhập lô mới' });
    const tooMuch = await shop('POST', `/products/${water.id}/stock`, manager, { reason: 'ADJUST', delta: -26 });
    expect(tooMuch.status).toBe(422);
    await shop('POST', `/products/${water.id}/stock`, manager, { reason: 'ADJUST', delta: -2, note: 'Vỡ' });

    expect(await stockOf(water.id)).toBe(23);
    const ledger = await readResult<Paginated<{ reason: string; delta: number; stockAfter: number }>>(
      await shop('GET', `/products/${water.id}/movements`, manager),
    );
    expect(ledger.items.map(({ reason, delta, stockAfter }) => [reason, delta, stockAfter])).toEqual([
      ['ADJUST', -2, 23],
      ['IMPORT', 20, 25],
      ['IMPORT', 5, 5],
    ]);
  });
});

describe('selling products', () => {
  test('an online order deducts stock at payment and waits for pickup at the counter', async () => {
    const { receptionist, member, water, shuttles } = await setup();
    await seedBalance(member.id, 100_000);

    const quote = await readResult<Quote>(
      await checkout('POST', '/quote', member, { items: [line(water.id, 3), line(shuttles.id, 2)] }),
    );
    expect(quote).toMatchObject({ total: 90_000, membershipDiscount: 0, canCheckout: true });

    const order = await readResult<Order>(await buy(member, [line(water.id, 3), line(shuttles.id, 2)], 90_000));
    await expectOrderConsistent(order.id);
    expect(order.items.map(({ productSale }) => productSale?.status)).toEqual(['PENDING_PICKUP', 'PENDING_PICKUP']);
    expect(await stockOf(water.id)).toBe(2);
    expect(await expectWalletConsistent(member.id)).toBe(10_000);

    const product = await readResult<Product>(await shop('GET', `/products/${water.id}`, receptionist));
    expect(product).toMatchObject({ stock: 2, reserved: 3 });

    const queue = await readResult<Paginated<ProductSale>>(
      await shop('GET', '/sales?status=PENDING_PICKUP', receptionist),
    );
    expect(queue.total).toBe(2);

    const saleId = order.items[0]!.productSale!.id;
    const picked = await readResult<ProductSale>(await shop('POST', `/sales/${saleId}/pickup`, receptionist));
    expect(picked).toMatchObject({ status: 'PICKED_UP', pickedUpBy: { id: receptionist.id } });
    expect(await readCode(await shop('POST', `/sales/${saleId}/pickup`, receptionist))).toBe('INVALID_STATE');
    expect(await readCode(await shop('POST', `/sales/${saleId}/cancel`, member, {}))).toBe('INVALID_STATE');
  });

  test('cannot buy more than is left, counting other lines and held counter invoices', async () => {
    const { receptionist, member, water } = await setup();
    await seedBalance(member.id, 1_000_000);

    const over = await readResult<Quote>(await checkout('POST', '/quote', member, { items: [line(water.id, 6)] }));
    expect(over.items[0]).toMatchObject({ valid: false, error: { message: 'Sản phẩm chỉ còn 5' } });

    const twice = await readResult<Quote>(
      await checkout('POST', '/quote', member, { items: [line(water.id, 1), line(water.id, 1)] }),
    );
    expect(twice.items[1]?.valid).toBe(false);

    // A transfer invoice at the counter holds 4 units until it is paid or expires.
    const invoice = await checkout('POST', '/invoices', receptionist, {
      buyer: { guest: { name: 'Khách', phone: '0912345678' } },
      items: [line(water.id, 4)],
      expectedTotal: 40_000,
    });
    expect(invoice.status).toBe(201);
    expect(await readCode(await buy(member, [line(water.id, 2)], 20_000))).toBe('CART_ITEM_INVALID');
    expect((await buy(member, [line(water.id, 1)], 10_000)).status).toBe(201);
  });

  test('a counter sale to a guest is handed over at once', async () => {
    const { receptionist, water } = await setup();

    const order = await readResult<Order>(
      await checkout('POST', '/', receptionist, {
        buyer: { guest: { name: 'Khách lẻ', phone: '0912345678' } },
        items: [line(water.id, 2)],
        paymentMethod: 'CASH',
        expectedTotal: 20_000,
        idempotencyKey: 'counter-12345678',
      }),
    );
    expect(order.items[0]?.productSale).toMatchObject({ status: 'PICKED_UP', quantity: 2 });
    expect(await stockOf(water.id)).toBe(3);
  });

  test('cancelling a pending pickup restocks and refunds the wallet; others cannot cancel it', async () => {
    const { member, water } = await setup();
    const stranger = await createAccount('MEMBER', 'stranger@example.com');
    await seedBalance(member.id, 50_000);

    const order = await readResult<Order>(await buy(member, [line(water.id, 2)], 20_000));
    const saleId = order.items[0]!.productSale!.id;

    expect((await shop('POST', `/sales/${saleId}/cancel`, stranger, {})).status).toBe(404);
    const cancelled = await readResult<{ sale: ProductSale; refund: number }>(
      await shop('POST', `/sales/${saleId}/cancel`, member, {}),
    );
    expect(cancelled).toMatchObject({ sale: { status: 'CANCELLED' }, refund: 20_000 });
    expect(await stockOf(water.id)).toBe(5);
    expect(await expectWalletConsistent(member.id)).toBe(50_000);
  });

  test('the pickup job cancels overdue orders and the report counts what stayed sold', async () => {
    const { manager, member, water, shuttles } = await setup();
    await seedBalance(member.id, 200_000);

    const late = await readResult<Order>(await buy(member, [line(water.id, 1)], 10_000, 'late-12345678'));
    await readResult<Order>(await buy(member, [line(shuttles.id, 2)], 60_000, 'kept-12345678'));
    await prisma.productSale.update({
      where: { id: late.items[0]!.productSale!.id },
      data: { pickupDeadline: new Date(Date.now() - 60_000) },
    });

    expect(await shopService.runPickupJob()).toMatchObject({ remaining: 0 });
    expect(await stockOf(water.id)).toBe(5);
    expect(await expectWalletConsistent(member.id)).toBe(140_000);

    const today = todayInCenter();
    const report = await readResult<ShopReport>(await shop('GET', `/report?from=${today}&to=${today}`, manager));
    expect(report).toMatchObject({ revenue: 60_000, units: 2, orders: 1, pendingPickups: 1 });
    expect(report.topProducts[0]?.product.id).toBe(shuttles.id);
  });
});
