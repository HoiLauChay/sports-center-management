import type { Product, ProductCategory, ProductSale, StockMovement } from '@sports-center/shared';

import type { ProductCategoryRow, ProductRow, ProductSaleRow, StockMovementRow } from '~/repositories/shop.repository';

export const toProductCategoryResponse = (row: ProductCategoryRow): ProductCategory => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sortOrder,
  isActive: row.isActive,
  productCount: row._count.products,
});

export const toProductResponse = (row: ProductRow, reserved = 0): Product => ({
  id: row.id,
  sku: row.sku,
  name: row.name,
  description: row.description,
  imageUrl: row.imageUrl,
  category: { id: row.category.id, name: row.category.name },
  sport: row.sport,
  price: Number(row.price),
  stock: row.stock,
  reserved,
  lowStockThreshold: row.lowStockThreshold,
  lowStock: row.stock <= row.lowStockThreshold,
  isActive: row.isActive,
});

export const toStockMovementResponse = (row: StockMovementRow): StockMovement => ({
  id: row.id,
  reason: row.reason,
  delta: row.delta,
  stockAfter: row.stockAfter,
  note: row.note,
  orderNumber: row.sale?.orderItem.order.orderNumber ?? null,
  createdBy: row.createdBy,
  createdAt: row.createdAt.toISOString(),
});

export const toProductSaleResponse = (row: ProductSaleRow): ProductSale => {
  const { order } = row.orderItem;
  return {
    id: row.id,
    status: row.status,
    quantity: row.quantity,
    pickupDeadline: row.pickupDeadline?.toISOString() ?? null,
    pickedUpAt: row.pickedUpAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderItemId: row.orderItemId,
    product: { id: row.product.id, sku: row.product.sku, name: row.product.name, imageUrl: row.product.imageUrl },
    unitPrice: Number(row.unitPrice),
    totalAmount: Number(row.orderItem.totalAmount),
    buyer: order.account
      ? { id: order.account.id, fullName: order.account.fullName, phone: order.account.phone }
      : { id: null, fullName: order.guestName ?? 'Khách vãng lai', phone: order.guestPhone },
    pickedUpBy: row.pickedUpBy,
    createdAt: row.createdAt.toISOString(),
  };
};
