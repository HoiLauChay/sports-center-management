import type { Invoice, InvoiceStatus, PaymentMethod, WalletTransactionType } from '@sports-center/shared';
import type { TagMap } from '~/components/ui/MappedTag';
import type { OrderStatus } from '~/features/checkout/types';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  WALLET: 'Ví',
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  TRANSFER: 'Chuyển khoản',
};

export const WALLET_TX_TAG: TagMap<WalletTransactionType> = {
  TOP_UP: { label: 'Nạp ví', color: 'success' },
  PAYMENT: { label: 'Thanh toán', color: 'processing' },
  REFUND: { label: 'Hoàn tiền', color: 'warning' },
};

export const INVOICE_STATUS_TAG: TagMap<InvoiceStatus> = {
  PENDING: { label: 'Chờ thanh toán', color: 'warning' },
  PAID: { label: 'Đã thanh toán', color: 'success' },
  EXPIRED: { label: 'Hết hạn' },
  CANCELLED: { label: 'Đã hủy' },
  FAILED: { label: 'Thất bại', color: 'error' },
};

/** A pending invoice past its deadline is shown as expired before the cleanup job marks it. */
export const invoiceStatusOf = (invoice: Pick<Invoice, 'status' | 'expiresAt'>, now = Date.now()): InvoiceStatus =>
  invoice.status === 'PENDING' && Date.parse(invoice.expiresAt) <= now ? 'EXPIRED' : invoice.status;

export const ORDER_STATUS_TAG: TagMap<OrderStatus> = {
  PAID: { label: 'Đã thanh toán', color: 'success' },
  PARTIALLY_REFUNDED: { label: 'Hoàn một phần', color: 'warning' },
  REFUNDED: { label: 'Đã hoàn tiền', color: 'error' },
};
