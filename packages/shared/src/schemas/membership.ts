import { z } from 'zod';

import { MAX_MONEY } from '../constants/money';

const nameSchema = z
  .string('Tên gói không được để trống')
  .trim()
  .min(1, 'Tên gói không được để trống')
  .max(255, 'Tên gói tối đa 255 ký tự');

const pctSchema = (label: string) =>
  z.int32(`${label} phải là số nguyên`).min(0, `${label} tối thiểu 0`).max(100, `${label} tối đa 100`);

const membershipFields = {
  name: nameSchema,
  description: z.string().trim().max(5000, 'Mô tả tối đa 5000 ký tự').nullable().optional(),
  price: z.int('Giá phải là số nguyên').min(0, 'Giá không được âm').max(MAX_MONEY, 'Giá quá lớn'),
  durationDays: z.int32('Số ngày phải là số nguyên').min(1, 'Số ngày tối thiểu là 1'),
  gymAccess: z.boolean('Quyền vào gym không hợp lệ'),
  bookingDiscountPct: pctSchema('Giảm giá booking'),
  classDiscountPct: pctSchema('Giảm giá lớp học'),
  freeBookingSlotsPerMonth: z.int32('Slot miễn phí phải là số nguyên').min(0, 'Slot miễn phí tối thiểu 0'),
  isActive: z.boolean('Trạng thái không hợp lệ'),
};

export const createMembershipBodySchema = z.object({
  ...membershipFields,
  gymAccess: membershipFields.gymAccess.default(false),
  bookingDiscountPct: membershipFields.bookingDiscountPct.default(0),
  classDiscountPct: membershipFields.classDiscountPct.default(0),
  freeBookingSlotsPerMonth: membershipFields.freeBookingSlotsPerMonth.default(0),
  isActive: membershipFields.isActive.default(true),
});

export const updateMembershipBodySchema = z.object(membershipFields).partial();

export const membershipIdParamsSchema = z.object({ id: z.uuid('Mã gói không hợp lệ') });

export const memberMembershipParamsSchema = z.object({
  id: z.uuid('Mã thành viên không hợp lệ'),
  membershipId: z.uuid('Mã gói của thành viên không hợp lệ'),
});

export type CreateMembershipBody = z.infer<typeof createMembershipBodySchema>;
export type CreateMembershipInput = z.input<typeof createMembershipBodySchema>;
export type UpdateMembershipBody = z.infer<typeof updateMembershipBodySchema>;
