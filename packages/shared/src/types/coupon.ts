import type { DiscountType, OrderItemType } from '../constants/enums';

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
