import { z } from 'zod';

const dateSchema = z.iso.date('Ngày không hợp lệ');

export const createCheckInBodySchema = z.object({ accountId: z.uuid('Mã thành viên không hợp lệ') });

export const listMyCheckInsQuerySchema = z
  .object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .refine(({ from, to }) => !from || !to || from <= to, {
    path: ['to'],
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
  });

export const listCheckInsQuerySchema = z.object({ date: dateSchema.optional() });

export type CreateCheckInBody = z.infer<typeof createCheckInBodySchema>;
export type ListMyCheckInsQuery = z.infer<typeof listMyCheckInsQuerySchema>;
export type ListCheckInsQuery = z.infer<typeof listCheckInsQuerySchema>;
