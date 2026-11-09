import type { FulfillmentStatus, Product, StockReason } from '@sports-center/shared';

export const FULFILLMENT_LABEL: Record<FulfillmentStatus, { label: string; color?: string }> = {
  PENDING_PICKUP: { label: 'Chờ nhận hàng', color: 'processing' },
  PICKED_UP: { label: 'Đã nhận', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'default' },
};

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  IMPORT: 'Nhập kho',
  ADJUST: 'Điều chỉnh',
  SALE: 'Bán',
  SALE_CANCEL: 'Hủy đơn, trả kho',
};

export function stockText(product: Pick<Product, 'stock'>) {
  if (!product.stock) return 'Hết hàng';
  return `Còn ${product.stock}`;
}

/** "còn 3 giờ" style countdown to a pickup deadline. */
export function timeLeftText(ms: number) {
  if (ms <= 0) return 'đã quá hạn';
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `còn ${hours} giờ`;
  return `còn ${Math.floor(hours / 24)} ngày`;
}
