import { ERROR_CODE, type CheckoutItemInput, type ProductSaleSnapshot } from '@sports-center/shared';

import shopRepository from '~/repositories/shop.repository';
import { lineError } from '~/services/checkout/lines/shared';
import type { CheckoutContext, LineHandler } from '~/services/checkout/types';

type ProductSaleInput = Extract<CheckoutItemInput, { type: 'PRODUCT_SALE' }>;

interface ProductSaleData {
  productId: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Units of a product already promised elsewhere: earlier lines of this order and
 * counter invoices still waiting for a bank transfer.
 */
const heldUnits = (ctx: CheckoutContext, productId: string) =>
  ctx.planned
    .filter(({ type, data }) => type === 'PRODUCT_SALE' && (data as ProductSaleData).productId === productId)
    .reduce((sum, { data }) => sum + (data as ProductSaleData).quantity, 0);

const outOfStock = (available: number) => (available > 0 ? `Sản phẩm chỉ còn ${available}` : 'Sản phẩm đã hết hàng');

export const productSaleHandler: LineHandler<ProductSaleInput, ProductSaleData, ProductSaleSnapshot> = {
  type: 'PRODUCT_SALE',
  guestAllowed: true,
  needsScheduleLock: false,

  lockTargets: (input) => ({ products: [input.productId] }),

  prepare: async (db, ctx, input) => {
    const product = await shopRepository.findVisibleProduct(input.productId, db);
    if (!product) return lineError(ERROR_CODE.NOT_FOUND, 'Sản phẩm không tồn tại hoặc đã ngừng bán');

    const available = product.stock - heldUnits(ctx, product.id);
    if (input.quantity > available) return lineError(ERROR_CODE.CONFLICT, outOfStock(Math.max(available, 0)));

    const unitPrice = Number(product.price);
    return {
      ok: true,
      subtotal: unitPrice * input.quantity,
      // Membership discounts cover center services only, not retail goods.
      membershipDiscount: 0,
      snapshot: {
        title: input.quantity > 1 ? `${product.name} × ${input.quantity}` : product.name,
        startAt: null,
        endAt: null,
        discountPct: 0,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        categoryName: product.category.name,
        sportName: product.sport?.name ?? null,
        imageUrl: product.imageUrl,
        quantity: input.quantity,
        unitPrice,
      },
      data: { productId: product.id, quantity: input.quantity, unitPrice },
    };
  },

  verify: async (tx, _ctx, { data }) => {
    const product = await shopRepository.findVisibleProduct(data.productId, tx);
    if (!product) return { code: ERROR_CODE.NOT_FOUND, message: 'Sản phẩm không tồn tại hoặc đã ngừng bán' };
    if (product.stock < data.quantity) {
      return { code: ERROR_CODE.CONFLICT, message: outOfStock(product.stock) };
    }
    return null;
  },

  fulfill: async (tx, ctx, { data }, orderItemId) => {
    // Bought online: the member collects at the counter. Sold by staff: handed over right away.
    const online = ctx.actor.role === 'MEMBER';
    const sale = await shopRepository.createSale(
      {
        orderItemId,
        productId: data.productId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        status: online ? 'PENDING_PICKUP' : 'PICKED_UP',
        pickupDeadline: online ? new Date(ctx.now.getTime() + ctx.settings.shopPickupHours * 3_600_000) : null,
        pickedUpAt: online ? null : ctx.now,
        pickedUpById: online ? null : ctx.actor.id,
      },
      tx,
    );

    const stockAfter = await shopRepository.changeStock(data.productId, -data.quantity, tx);
    // prepare/verify ran under the product row lock, so stock cannot have dropped since.
    if (stockAfter === null) throw new Error(`Stock of product ${data.productId} fell below an order line`);
    await shopRepository.createMovement(
      {
        productId: data.productId,
        reason: 'SALE',
        delta: -data.quantity,
        stockAfter,
        saleId: sale.id,
        createdById: online ? null : ctx.actor.id,
      },
      tx,
    );
    return { refId: sale.id };
  },
};
