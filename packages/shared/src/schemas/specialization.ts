import { z } from 'zod';

import { SPECIALIZATION_STATUSES } from '../constants/enums';
import { optionalText } from './account';
import { pageQuerySchema } from './pagination';

export const SPECIALIZATION_MAX_CERTIFICATES = 5;

export const createSpecializationBodySchema = z
  .object({
    sportId: z.uuid('Mã bộ môn không hợp lệ'),
    experienceYears: z
      .int('Số năm kinh nghiệm không hợp lệ')
      .min(0, 'Số năm kinh nghiệm không hợp lệ')
      .max(60, 'Số năm kinh nghiệm tối đa 60')
      .nullable()
      .optional(),
    experienceNote: optionalText(1000, 'Mô tả kinh nghiệm'),
    certificates: z
      .array(z.url('Tệp chứng chỉ không hợp lệ'))
      .max(SPECIALIZATION_MAX_CERTIFICATES, `Tối đa ${SPECIALIZATION_MAX_CERTIFICATES} tệp chứng chỉ`)
      .default([]),
  })
  .refine((body) => Boolean(body.experienceNote) || body.certificates.length > 0, {
    path: ['experienceNote'],
    message: 'Cần mô tả kinh nghiệm hoặc ít nhất một tệp chứng chỉ',
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
export type CreateSpecializationInput = z.input<typeof createSpecializationBodySchema>;
export type ReviewSpecializationBody = z.infer<typeof reviewSpecializationBodySchema>;
export type ListSpecializationsQuery = z.infer<typeof listSpecializationsQuerySchema>;
