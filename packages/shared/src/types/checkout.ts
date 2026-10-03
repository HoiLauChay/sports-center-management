import type { OrderItemType } from '../constants/enums';
import type { CheckoutItemInput } from '../schemas/checkout';

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
