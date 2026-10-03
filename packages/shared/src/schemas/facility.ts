import { z } from 'zod';

import { FACILITY_TYPES } from '../constants/enums';
import { MAX_MONEY } from '../constants/money';
import { optionalText } from './account';

const nameSchema = z
  .string('Tên cơ sở không được để trống')
  .trim()
  .min(1, 'Tên cơ sở không được để trống')
  .max(100, 'Tên cơ sở tối đa 100 ký tự');

const sportIdsSchema = z
  .array(z.uuid('Mã bộ môn không hợp lệ'), 'Danh sách bộ môn không hợp lệ')
  .max(50, 'Tối đa 50 bộ môn')
  .refine((ids) => new Set(ids).size === ids.length, 'Bộ môn bị trùng');

export const createFacilityBodySchema = z.object({
  name: nameSchema,
  type: z.enum(FACILITY_TYPES, 'Loại cơ sở không hợp lệ'),
  description: optionalText(5000, 'Mô tả'),
  capacityPerSlot: z.int32('Sức chứa phải là số nguyên').min(1, 'Sức chứa tối thiểu là 1'),
  pricePerSlot: z
    .int('Giá mỗi slot phải là số nguyên')
    .min(0, 'Giá mỗi slot không được âm')
    .max(MAX_MONEY, 'Giá mỗi slot quá lớn'),
  isActive: z.boolean('Trạng thái không hợp lệ').default(true),
  sportIds: sportIdsSchema.default([]),
});

export const updateFacilityBodySchema = createFacilityBodySchema
  .omit({ isActive: true, sportIds: true })
  .partial()
  .extend({
    isActive: z.boolean('Trạng thái không hợp lệ').optional(),
    sportIds: sportIdsSchema.optional(),
  });

export const listFacilitiesQuerySchema = z.object({
  type: z.enum(FACILITY_TYPES, 'Loại cơ sở không hợp lệ').optional(),
  sportId: z.uuid('Mã bộ môn không hợp lệ').optional(),
  isActive: z.stringbool('Trạng thái không hợp lệ').optional(),
});

export const facilityIdParamsSchema = z.object({ id: z.uuid('Mã cơ sở không hợp lệ') });

export const facilityScheduleQuerySchema = z.object({ date: z.iso.date('Ngày không hợp lệ') });

export type CreateFacilityBody = z.infer<typeof createFacilityBodySchema>;
export type CreateFacilityInput = z.input<typeof createFacilityBodySchema>;
export type UpdateFacilityBody = z.infer<typeof updateFacilityBodySchema>;
export type ListFacilitiesQuery = z.infer<typeof listFacilitiesQuerySchema>;
export type FacilityScheduleQuery = z.infer<typeof facilityScheduleQuerySchema>;
