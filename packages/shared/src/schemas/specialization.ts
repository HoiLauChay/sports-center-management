import { z } from 'zod';

export const createSpecializationBodySchema = z.object({
  sportId: z.uuid('Mã bộ môn không hợp lệ'),
});

export const reviewSpecializationBodySchema = z.object({
  reviewNote: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').nullable().optional(),
});

export const specializationIdParamsSchema = z.object({
  id: z.uuid('Mã chuyên môn không hợp lệ'),
});

export type CreateSpecializationBody = z.infer<typeof createSpecializationBodySchema>;
export type ReviewSpecializationBody = z.infer<typeof reviewSpecializationBodySchema>;
