import type { CheckoutItemInput, OrderItemType } from '@sports-center/shared';

export type {
  CheckoutBody,
  CheckoutBuyer,
  CheckoutItemInput,
  CheckoutQuoteBody,
  CounterInvoiceBody,
  ListOrdersQuery,
  Order,
  OrderItem,
  OrderItemType,
  OrderRefund,
  OrderStatus,
  Quote,
  QuoteLine,
} from '@sports-center/shared';

export const ORDER_ITEM_TYPES = [
  'FACILITY_BOOKING',
  'FACILITY_PACKAGE',
  'COURSE_ENROLLMENT',
  'MEMBERSHIP',
] as const satisfies readonly OrderItemType[];

export const ORDER_ITEM_TYPE_LABEL: Record<OrderItemType, string> = {
  FACILITY_BOOKING: 'Đặt sân / phòng',
  FACILITY_PACKAGE: 'Gói sân định kỳ',
  COURSE_ENROLLMENT: 'Đăng ký lớp',
  MEMBERSHIP: 'Gói thành viên',
};

/** One line of the cart that is stored in the browser: the selection plus a stable key. */
export interface CartLine {
  key: string;
  selection: CheckoutItemInput;
}

export interface LineDescription {
  title: string;
  detail: string;
}
