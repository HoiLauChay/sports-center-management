import { z } from 'zod';

const ratingSchema = z.int('Điểm phải là số nguyên').min(1, 'Điểm từ 1 đến 5').max(5, 'Điểm từ 1 đến 5');
const commentSchema = z.string().trim().max(2000, 'Nhận xét tối đa 2000 ký tự');

export const saveSessionNoteBodySchema = z.object({
  title: z.string('Vui lòng nhập tiêu đề').trim().min(1, 'Vui lòng nhập tiêu đề').max(255, 'Tiêu đề tối đa 255 ký tự'),
  content: z.string('Vui lòng nhập nội dung').trim().min(1, 'Vui lòng nhập nội dung').max(20_000, 'Nội dung quá dài'),
  attachments: z
    .array(z.url('Tệp đính kèm không hợp lệ'), 'Tệp đính kèm không hợp lệ')
    .max(10, 'Tối đa 10 tệp')
    .default([]),
});

export const createEvaluationBodySchema = z.object({
  accountId: z.uuid('Mã học viên không hợp lệ'),
  rating: ratingSchema,
  comment: commentSchema.optional(),
});

export const updateEvaluationBodySchema = z
  .object({ rating: ratingSchema.optional(), comment: commentSchema.optional() })
  .refine((body) => body.rating !== undefined || body.comment !== undefined, 'Cần ít nhất một trường để cập nhật');

export const evaluationIdParamsSchema = z.object({ id: z.uuid('Mã đánh giá không hợp lệ') });

export const myEvaluationsQuerySchema = z.object({ classId: z.uuid('Mã lớp không hợp lệ').optional() });

export const createAnnouncementBodySchema = z.object({
  title: z.string('Vui lòng nhập tiêu đề').trim().min(1, 'Vui lòng nhập tiêu đề').max(255, 'Tiêu đề tối đa 255 ký tự'),
  body: z
    .string('Vui lòng nhập nội dung')
    .trim()
    .min(1, 'Vui lòng nhập nội dung')
    .max(5000, 'Nội dung tối đa 5000 ký tự'),
});

export type SaveSessionNoteBody = z.infer<typeof saveSessionNoteBodySchema>;
export type CreateEvaluationBody = z.infer<typeof createEvaluationBodySchema>;
export type UpdateEvaluationBody = z.infer<typeof updateEvaluationBodySchema>;
export type MyEvaluationsQuery = z.infer<typeof myEvaluationsQuerySchema>;
export type CreateAnnouncementBody = z.infer<typeof createAnnouncementBodySchema>;
