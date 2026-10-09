import { z } from 'zod';

const MAX_RANGE_DAYS = 92;

export const personalScheduleQuerySchema = z
  .object({
    from: z.iso.date('Ngày bắt đầu không hợp lệ'),
    to: z.iso.date('Ngày kết thúc không hợp lệ'),
  })
  .superRefine(({ from, to }, ctx) => {
    if (from > to) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu' });
    } else if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= MAX_RANGE_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày` });
    }
  });

export type PersonalScheduleQuery = z.infer<typeof personalScheduleQuerySchema>;
