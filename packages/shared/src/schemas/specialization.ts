import { z } from 'zod';

import { SPECIALIZATION_STATUSES } from '../constants/enums';
import { optionalText } from './account';
import { pageQuerySchema } from './pagination';

export const createSpecializationBodySchema = z.object({
  sportId: z.uuid('Mã bộ môn không hợp lệ'),
});

export const reviewSpecializationBodySchema = z.object({
  reviewNote: optionalText(500, 'Ghi chú'),
});

export const listSpecializationsQuerySchema = pageQuerySchema.extend({
  status: z.enum(SPECIALIZATION_STATUSES, 'Trạng thái không hợp lệ').optional(),
  coachId: z.uuid('Mã huấn luyện viên không hợp lệ').optional(),
  sportId: z.uuid('Mã bộ môn không hợp lệ').optional(),
});

export const specializationIdParamsSchema = z.object({
  id: z.uuid('Mã chuyên môn không hợp lệ'),
});

export type CreateSpecializationBody = z.infer<typeof createSpecializationBodySchema>;
export type ReviewSpecializationBody = z.infer<typeof reviewSpecializationBodySchema>;
export type ListSpecializationsQuery = z.infer<typeof listSpecializationsQuerySchema>;
