import { z } from 'zod';

const MAX_RANGE_DAYS = 366;

export const REPORT_GRANULARITIES = ['day', 'week', 'month'] as const;

export const reportRangeQuerySchema = z
  .object({
    from: z.iso.date('Ngày bắt đầu không hợp lệ'),
    to: z.iso.date('Ngày kết thúc không hợp lệ'),
    granularity: z.enum(REPORT_GRANULARITIES, 'Đơn vị thời gian không hợp lệ').default('day'),
  })
  .superRefine(({ from, to }, ctx) => {
    if (from > to) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: 'Ngày kết thúc phải sau ngày bắt đầu' });
    } else if ((Date.parse(to) - Date.parse(from)) / 86_400_000 >= MAX_RANGE_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['to'], message: `Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày` });
    }
  });

export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;
