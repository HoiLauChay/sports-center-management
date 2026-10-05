import { z } from 'zod';

import { SUPPORT_CATEGORIES, SUPPORT_STATUSES } from '../constants/enums';
import { pageQuerySchema } from './pagination';

export const createSupportBodySchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES, 'Loại yêu cầu không hợp lệ'),
  subject: z.string().trim().min(1, 'Vui lòng nhập tiêu đề').max(255, 'Tiêu đề tối đa 255 ký tự'),
  description: z.string().trim().min(1, 'Vui lòng mô tả vấn đề').max(5000, 'Nội dung tối đa 5000 ký tự'),
});

export const updateSupportBodySchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES, 'Trạng thái không hợp lệ').optional(),
    resolutionNote: z.string().trim().max(5000, 'Phản hồi tối đa 5000 ký tự').optional(),
  })
  .refine((body) => body.status !== undefined || body.resolutionNote !== undefined, {
    message: 'Vui lòng cung cấp trạng thái hoặc phản hồi',
  });

export const listSupportQuerySchema = pageQuerySchema.extend({
  status: z.enum(SUPPORT_STATUSES).optional(),
  category: z.enum(SUPPORT_CATEGORIES).optional(),
  q: z.string().trim().max(255).optional(),
});

export const supportIdParamsSchema = z.object({ id: z.uuid('Mã yêu cầu không hợp lệ') });

export type CreateSupportBody = z.infer<typeof createSupportBodySchema>;
export type UpdateSupportBody = z.infer<typeof updateSupportBodySchema>;
export type ListSupportQuery = z.infer<typeof listSupportQuerySchema>;
