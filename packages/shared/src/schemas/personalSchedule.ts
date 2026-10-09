import { z } from 'zod';

export const personalScheduleQuerySchema = z
  .object({
    from: z.iso.date('Ngày bắt đầu không hợp lệ'),
    to: z.iso.date('Ngày kết thúc không hợp lệ'),
  })
  .refine(({ from, to }) => from <= to, {
    path: ['to'],
    message: 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu',
  });

export type PersonalScheduleQuery = z.infer<typeof personalScheduleQuerySchema>;
