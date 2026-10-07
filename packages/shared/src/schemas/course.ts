import { z } from 'zod';

import { MAX_MONEY } from '../constants/money';
import { optionalText, optionalUrl } from './account';

const nameSchema = z
  .string('Tên khóa học không được để trống')
  .trim()
  .min(1, 'Tên khóa học không được để trống')
  .max(255, 'Tên khóa học tối đa 255 ký tự');

export const createCourseBodySchema = z.object({
  name: nameSchema,
  description: optionalText(5000, 'Mô tả'),
  sportId: z.string().min(1, 'Mã bộ môn không hợp lệ'),
  totalSessions: z.int32('Số buổi phải là số nguyên').min(1, 'Số buổi tối thiểu là 1'),
  price: z.int('Giá phải là số nguyên').min(0, 'Giá không được âm').max(MAX_MONEY, 'Giá quá lớn'),
  thumbnailUrl: optionalUrl('Ảnh khóa học'),
});

export const updateCourseBodySchema = createCourseBodySchema.partial();

export const courseIdParamsSchema = z.object({ id: z.string().min(1, 'Mã khóa học không hợp lệ') });

export type CreateCourseBody = z.infer<typeof createCourseBodySchema>;
export type UpdateCourseBody = z.infer<typeof updateCourseBodySchema>;
