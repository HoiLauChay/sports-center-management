import type { Coupon } from '@sports-center/shared';

export type { Coupon, DiscountType } from '@sports-center/shared';

export type CouponInput = Omit<Coupon, 'id' | 'usedCount'>;

export type CouponState = 'LIVE' | 'SCHEDULED' | 'EXPIRED' | 'USED_UP' | 'OFF';
