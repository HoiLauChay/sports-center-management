import { z } from 'zod';

const MAX_RANGE_DAYS = 366;

export const REPORT_GRANULARITIES = ['day', 'week', 'month'] as const;
export const REPORT_TYPES = ['overview', 'revenue', 'wallet', 'members', 'facilities', 'courses'] as const;
export const REPORT_EXPORT_FORMATS = ['pdf', 'xlsx'] as const;

export const reportDateQuerySchema = z
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

export const reportRangeQuerySchema = reportDateQuerySchema.safeExtend({
  granularity: z.enum(REPORT_GRANULARITIES, 'Đơn vị thời gian không hợp lệ').default('day'),
});

export const reportExportQuerySchema = reportRangeQuerySchema.safeExtend({
  report: z.enum(REPORT_TYPES, 'Loại báo cáo không hợp lệ'),
  format: z.enum(REPORT_EXPORT_FORMATS, 'Định dạng tệp không hợp lệ'),
});

export type ReportDateQuery = z.infer<typeof reportDateQuerySchema>;
export type ReportGranularity = (typeof REPORT_GRANULARITIES)[number];
export type ReportRangeQuery = z.infer<typeof reportRangeQuerySchema>;
export type ReportType = (typeof REPORT_TYPES)[number];
export type ReportExportQuery = z.infer<typeof reportExportQuerySchema>;
