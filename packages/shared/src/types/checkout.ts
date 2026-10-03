import type { OrderItemType, OrderStatus, PaymentMethod } from '../constants/enums';
import type { CheckoutItemInput } from '../schemas/checkout';
import type { Person } from './audit';

export interface QuoteLine {
  lineNumber: number;
  type: OrderItemType;
  selection: CheckoutItemInput;
  valid: boolean;
  error?: { code: string; message: string };
  snapshot: Record<string, unknown> | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  total: number;
}

export interface Quote {
  items: QuoteLine[];
  coupon: { code: string; valid: boolean; discount: number; error?: string } | null;
  subtotal: number;
  membershipDiscount: number;
  couponDiscount: number;
  total: number;
  walletBalance: number | null;
  canCheckout: boolean;
}

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
  refId: string | null;
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
