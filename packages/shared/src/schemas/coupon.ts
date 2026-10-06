import { z } from 'zod';

import { DISCOUNT_TYPES, ORDER_ITEM_TYPES } from '../constants/enums';
import { MAX_MONEY } from '../constants/money';

const MAX_INT = 2_147_483_647;

const moneySchema = (label: string, min: number) =>
  z
    .int(`${label} phải là số nguyên`)
    .min(min, `${label} tối thiểu là ${min.toLocaleString('vi-VN')}`)
    .max(MAX_MONEY, `${label} quá lớn`);

const dateTimeSchema = z.iso.datetime({ offset: true, message: 'Thời gian không hợp lệ' });

const couponFields = {
  code: z
    .string('Mã không được để trống')
    .trim()
    .toUpperCase()
    .min(3, 'Mã tối thiểu 3 ký tự')
    .max(50, 'Mã tối đa 50 ký tự')
    .regex(/^[A-Z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch ngang và gạch dưới'),
  name: z.string('Tên không được để trống').trim().min(1, 'Tên không được để trống').max(255, 'Tên tối đa 255 ký tự'),
  discountType: z.enum(DISCOUNT_TYPES, 'Loại giảm không hợp lệ'),
  discountValue: moneySchema('Giá trị giảm', 1),
  maxDiscount: moneySchema('Mức giảm tối đa', 1).nullable(),
  minOrderAmount: moneySchema('Ngưỡng tối thiểu', 0).nullable(),
  maxUses: z
    .int('Tổng lượt dùng phải là số nguyên')
    .min(1, 'Tổng lượt dùng tối thiểu là 1')
    .max(MAX_INT, 'Tổng lượt dùng quá lớn')
    .nullable(),
  maxUsesPerUser: z
    .int('Lượt dùng mỗi người phải là số nguyên')
    .min(1, 'Lượt dùng mỗi người tối thiểu là 1')
    .max(MAX_INT, 'Lượt dùng mỗi người quá lớn'),
  applicableTypes: z
    .array(z.enum(ORDER_ITEM_TYPES, 'Loại dịch vụ không hợp lệ'), 'Loại dịch vụ không hợp lệ')
    .refine((types) => new Set(types).size === types.length, 'Loại dịch vụ bị trùng')
    .nullable(),
  validFrom: dateTimeSchema,
  validTo: dateTimeSchema,
  isActive: z.boolean('Trạng thái không hợp lệ'),
};

export const createCouponBodySchema = z.object({
  ...couponFields,
  maxDiscount: couponFields.maxDiscount.default(null),
  minOrderAmount: couponFields.minOrderAmount.default(null),
  maxUses: couponFields.maxUses.default(null),
  maxUsesPerUser: couponFields.maxUsesPerUser.default(1),
  applicableTypes: couponFields.applicableTypes.default(null),
  isActive: couponFields.isActive.default(true),
});

export const updateCouponBodySchema = z.object(couponFields).partial();

export const couponIdParamsSchema = z.object({ id: z.uuid('Mã giảm giá không hợp lệ') });

export type CreateCouponBody = z.infer<typeof createCouponBodySchema>;
export type CreateCouponInput = z.input<typeof createCouponBodySchema>;
export type UpdateCouponBody = z.infer<typeof updateCouponBodySchema>;
