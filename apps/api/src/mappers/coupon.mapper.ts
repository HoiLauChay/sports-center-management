import type { Coupon } from '@sports-center/shared';

import type { CouponRow } from '~/repositories/coupon.repository';

const money = (value: CouponRow['maxDiscount']) => (value === null ? null : Number(value));

export const toCouponResponse = (row: CouponRow, usedCount: number): Coupon => ({
  id: row.id,
  code: row.code,
  name: row.name,
  discountType: row.discountType,
  discountValue: Number(row.discountValue),
  maxDiscount: money(row.maxDiscount),
  validFrom: row.validFrom.toISOString(),
  validTo: row.validTo.toISOString(),
  maxUses: row.maxUses,
  maxUsesPerUser: row.maxUsesPerUser,
  minOrderAmount: money(row.minOrderAmount),
  applicableTypes: row.applicableTypes.length ? row.applicableTypes : null,
  isActive: row.isActive,
  usedCount,
});
