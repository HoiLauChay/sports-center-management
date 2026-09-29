import { z } from 'zod';

import { MAX_MONEY } from '../constants/money';

const nameSchema = z
  .string('Tên gói không được để trống')
  .trim()
  .min(1, 'Tên gói không được để trống')
  .max(255, 'Tên gói tối đa 255 ký tự');

const pctSchema = (label: string) =>
  z.int32(`${label} phải là số nguyên`).min(0, `${label} tối thiểu 0`).max(100, `${label} tối đa 100`);

export const createMembershipBodySchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự').nullable().optional(),
  price: z.int('Giá phải là số nguyên').min(0, 'Giá không được âm').max(MAX_MONEY, 'Giá quá lớn'),
  durationDays: z.int32('Số ngày phải là số nguyên').min(1, 'Số ngày tối thiểu là 1'),
  gymAccess: z.boolean('Quyền vào gym không hợp lệ').default(false),
  bookingDiscountPct: pctSchema('Giảm giá booking').default(0),
  classDiscountPct: pctSchema('Giảm giá lớp học').default(0),
  freeBookingSlotsPerMonth: z.int32('Slot miễn phí phải là số nguyên').min(0, 'Slot miễn phí tối thiểu 0').default(0),
  isActive: z.boolean('Trạng thái không hợp lệ').default(true),
});

export const updateMembershipBodySchema = createMembershipBodySchema
  .omit({ isActive: true })
  .partial()
  .extend({
    isActive: z.boolean('Trạng thái không hợp lệ').optional(),
  });

export const membershipIdParamsSchema = z.object({ id: z.uuid('Mã gói không hợp lệ') });

export type CreateMembershipBody = z.infer<typeof createMembershipBodySchema>;
export type CreateMembershipInput = z.input<typeof createMembershipBodySchema>;
export type UpdateMembershipBody = z.infer<typeof updateMembershipBodySchema>;
