import type { PaymentMethod, Person } from '@sports-center/shared';

export const ORDER_ITEM_TYPES = ['FACILITY_BOOKING', 'FACILITY_PACKAGE', 'COURSE_ENROLLMENT', 'MEMBERSHIP'] as const;
export type OrderItemType = (typeof ORDER_ITEM_TYPES)[number];

export const ORDER_ITEM_TYPE_LABEL: Record<OrderItemType, string> = {
  FACILITY_BOOKING: 'Đặt sân / phòng',
  FACILITY_PACKAGE: 'Gói sân định kỳ',
  COURSE_ENROLLMENT: 'Đăng ký lớp',
  MEMBERSHIP: 'Gói thành viên',
};

export type CheckoutItemInput =
  | { type: 'FACILITY_BOOKING'; facilityId: string; date: string; startTime: string; endTime: string }
  | {
      type: 'FACILITY_PACKAGE';
      facilityId: string;
      startDate: string;
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
      weeks: number;
    }
  | { type: 'COURSE_ENROLLMENT'; classId: string }
  | { type: 'MEMBERSHIP'; packageId: string };

export type Buyer = { accountId: string } | { guest: { name: string; phone: string } };

export interface QuoteItem {
  lineNumber: number;
  type: OrderItemType;
  selection: CheckoutItemInput;
  valid: boolean;
  error?: { code: string; message: string };
  snapshot: Record<string, unknown>;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  total: number;
}

export interface QuoteCoupon {
  code: string;
  valid: boolean;
  discount: number;
  error?: string;
}

export interface Quote {
  items: QuoteItem[];
  coupon: QuoteCoupon | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  total: number;
  walletBalance: number | null;
  canCheckout: boolean;
}

export interface QuoteRequest {
  buyer?: Buyer;
  items: CheckoutItemInput[];
  couponCode?: string;
}

export interface CheckoutRequest extends QuoteRequest {
  paymentMethod: PaymentMethod;
  expectedTotal: number;
  idempotencyKey: string;
}

export type OrderStatus = 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

export interface OrderItem {
  id: string;
  lineNumber: number;
  type: OrderItemType;
  snapshot: Record<string, unknown>;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  totalAmount: number;
  refundedAmount: number;
  refId: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  account: Person | null;
  guestName: string | null;
  guestPhone: string | null;
  createdBy: Person | null;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  coupon: { code: string; discount: number } | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  totalAmount: number;
  refundedAmount: number;
  items: OrderItem[];
  paidAt: string;
}

export interface ListOrdersQuery {
  page: number;
  limit: number;
  from?: string;
  to?: string;
  status?: OrderStatus;
  orderNumber?: string;
  accountId?: string;
  guestPhone?: string;
}

/** One line of the cart that is stored in the browser: the selection plus a stable key. */
export interface CartLine {
  key: string;
  selection: CheckoutItemInput;
}

export interface LineDescription {
  title: string;
  detail: string;
}
