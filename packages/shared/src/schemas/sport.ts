import { z } from 'zod';

import { optionalText, optionalUrl } from './account';

const nameSchema = z
  .string('Tên bộ môn không được để trống')
  .trim()
  .min(1, 'Tên bộ môn không được để trống')
  .max(100, 'Tên bộ môn tối đa 100 ký tự');

export const createSportBodySchema = z.object({
  name: nameSchema,
  description: optionalText(5000, 'Mô tả'),
  iconUrl: optionalUrl('URL icon'),
});

export const updateSportBodySchema = createSportBodySchema.partial().extend({
  isActive: z.boolean('Trạng thái không hợp lệ').optional(),
});

export const sportIdParamsSchema = z.object({ id: z.uuid('Mã bộ môn không hợp lệ') });

export type CreateSportBody = z.infer<typeof createSportBodySchema>;
export type UpdateSportBody = z.infer<typeof updateSportBodySchema>;
