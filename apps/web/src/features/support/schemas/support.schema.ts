import { z } from 'zod';
import { SUPPORT_CATEGORIES } from '../types';

export const createSupportSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES, 'Vui lòng chọn loại yêu cầu'),
  subject: z
    .string('Vui lòng nhập tiêu đề')
    .trim()
    .min(1, 'Vui lòng nhập tiêu đề')
    .max(255, 'Tiêu đề tối đa 255 ký tự'),
  description: z
    .string('Vui lòng mô tả vấn đề')
    .trim()
    .min(1, 'Vui lòng mô tả vấn đề')
    .max(5000, 'Nội dung tối đa 5000 ký tự'),
});

export type CreateSupportInput = z.input<typeof createSupportSchema>;
export type CreateSupportValues = z.output<typeof createSupportSchema>;

export const resolutionNoteSchema = z.string().trim().max(5000, 'Phản hồi tối đa 5000 ký tự');
