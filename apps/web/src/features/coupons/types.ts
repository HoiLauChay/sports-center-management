import type { OrderItemType } from '~/features/checkout/types';

export type DiscountType = 'PERCENT' | 'FIXED';

export interface Coupon {
  id: string;
  code: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number | null;
  validFrom: string;
  validTo: string;
  maxUses: number | null;
  maxUsesPerUser: number;
  minOrderAmount: number | null;
  applicableTypes: OrderItemType[] | null;
  isActive: boolean;
  usedCount: number;
}

export type CouponInput = Omit<Coupon, 'id' | 'usedCount'>;

export type CouponState = 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'USED_UP' | 'OFF';
