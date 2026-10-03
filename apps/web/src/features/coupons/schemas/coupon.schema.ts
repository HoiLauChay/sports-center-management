import { MAX_MONEY } from '@sports-center/shared';
import { z } from 'zod';
import { ORDER_ITEM_TYPES } from '~/features/checkout/types';

const optionalInt = (label: string, min: number, max = MAX_MONEY) =>
  z
    .int(`${label} phải là số nguyên`)
    .min(min, `${label} tối thiểu là ${min.toLocaleString('vi-VN')}`)
    .max(max, `${label} quá lớn`)
    .nullable();

export const couponSchema = z
  .object({
    code: z
      .string('Vui lòng nhập mã')
      .trim()
      .min(3, 'Mã tối thiểu 3 ký tự')
      .max(50, 'Mã tối đa 50 ký tự')
      .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch ngang và gạch dưới')
      .transform((code) => code.toUpperCase()),
    name: z.string('Vui lòng nhập tên').trim().min(1, 'Vui lòng nhập tên').max(255, 'Tên tối đa 255 ký tự'),
    discountType: z.enum(['PERCENT', 'FIXED'], 'Vui lòng chọn loại giảm'),
    discountValue: z
      .int('Giá trị phải là số nguyên')
      .min(1, 'Giá trị phải lớn hơn 0')
      .max(MAX_MONEY, 'Giá trị quá lớn'),
    maxDiscount: optionalInt('Mức giảm tối đa', 1),
    validFrom: z.string('Vui lòng chọn thời gian hiệu lực').min(1, 'Vui lòng chọn thời gian hiệu lực'),
    validTo: z.string('Vui lòng chọn thời gian hiệu lực').min(1, 'Vui lòng chọn thời gian hiệu lực'),
    maxUses: optionalInt('Tổng lượt dùng', 1, 2_147_483_647),
    maxUsesPerUser: z
      .int('Lượt dùng mỗi người phải là số nguyên')
      .min(1, 'Lượt dùng mỗi người tối thiểu là 1')
      .max(2_147_483_647, 'Lượt dùng quá lớn'),
    minOrderAmount: optionalInt('Ngưỡng tối thiểu', 0),
    applicableTypes: z.array(z.enum(ORDER_ITEM_TYPES)),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.discountType === 'PERCENT' && value.discountValue > 100) {
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Phần trăm giảm không được vượt quá 100' });
    }
    if (value.validFrom && value.validTo && value.validTo <= value.validFrom) {
      ctx.addIssue({ code: 'custom', path: ['validTo'], message: 'Ngày kết thúc phải sau ngày bắt đầu' });
    }
  });

export type CouponFormInput = z.input<typeof couponSchema>;
export type CouponFormValues = z.output<typeof couponSchema>;
