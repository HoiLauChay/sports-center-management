import { z } from 'zod';

import { REPORT_TYPES, reportRangeQuerySchema } from './report';

/** Jobs that watch the center and tell the manager (or the people concerned) when something needs a look. */
export const AUTOMATION_KEYS = [
  'WEEKLY_DIGEST',
  'PROMO_SUGGESTION',
  'UNDERFILLED_CLASS',
  'UNMATCHED_BANK',
  'OVERDUE_SUPPORT',
  'INACTIVE_MEMBERS',
] as const;
export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

export interface AutomationDefinition {
  label: string;
  description: string;
  /** Whether it writes with AI (and falls back to a plain template when AI is down). */
  ai: boolean;
  /** The one number the manager can tune, or null when there is none. */
  threshold: { default: number; min: number; max: number; unit: string; label: string } | null;
}

export const AUTOMATIONS: Record<AutomationKey, AutomationDefinition> = {
  WEEKLY_DIGEST: {
    label: 'Bản tóm tắt tuần',
    description: 'Sáng thứ 2, AI tóm tắt doanh thu, sân, lớp và hội viên tuần trước, kèm gợi ý việc nên làm.',
    ai: true,
    threshold: null,
  },
  PROMO_SUGGESTION: {
    label: 'Gợi ý khuyến mãi giờ vắng',
    description: 'Tìm khung giờ có tỉ lệ lấp sân thấp trong 4 tuần qua và đề xuất mã giảm giá cho tuần tới.',
    ai: true,
    threshold: { default: 30, min: 5, max: 80, unit: '%', label: 'Tỉ lệ lấp dưới' },
  },
  UNDERFILLED_CLASS: {
    label: 'Lớp sắp bị hủy vì thiếu học viên',
    description: 'Báo trước khi hệ thống tự hủy lớp chưa đủ sĩ số tối thiểu, để kịp đẩy tuyển sinh.',
    ai: false,
    threshold: { default: 3, min: 1, max: 14, unit: 'ngày', label: 'Báo trước' },
  },
  UNMATCHED_BANK: {
    label: 'Giao dịch ngân hàng chưa khớp',
    description: 'Nhắc khi có chuyển khoản chưa được ghi nhận cho hội viên nào quá lâu.',
    ai: false,
    threshold: { default: 24, min: 1, max: 168, unit: 'giờ', label: 'Chưa khớp quá' },
  },
  OVERDUE_SUPPORT: {
    label: 'Yêu cầu hỗ trợ quá hạn',
    description: 'Báo lễ tân và Manager khi yêu cầu hỗ trợ còn ở trạng thái chờ quá lâu.',
    ai: false,
    threshold: { default: 24, min: 1, max: 168, unit: 'giờ', label: 'Chờ quá' },
  },
  INACTIVE_MEMBERS: {
    label: 'Hội viên lâu không quay lại',
    description: 'Mỗi tuần thống kê hội viên còn hoạt động nhưng không đặt sân, không đi học, không check-in.',
    ai: false,
    threshold: { default: 30, min: 7, max: 180, unit: 'ngày', label: 'Vắng mặt' },
  },
};

export const automationKeyParamsSchema = z.object({ key: z.enum(AUTOMATION_KEYS, 'Loại tự động hóa không hợp lệ') });

export const updateAutomationBodySchema = z
  .strictObject({
    enabled: z.boolean('Trạng thái không hợp lệ').optional(),
    threshold: z.int('Ngưỡng phải là số nguyên').min(1, 'Ngưỡng tối thiểu là 1').max(1000).optional(),
  })
  .refine((body) => body.enabled !== undefined || body.threshold !== undefined, 'Cần đổi trạng thái hoặc ngưỡng');

export const reportInsightBodySchema = reportRangeQuerySchema.safeExtend({
  report: z.enum(REPORT_TYPES, 'Loại báo cáo không hợp lệ'),
});

export const maintenanceAnnounceBodySchema = z.strictObject({
  title: z.string('Cần nhập tiêu đề').trim().min(1, 'Cần nhập tiêu đề').max(255, 'Tiêu đề tối đa 255 ký tự'),
  message: z.string('Cần nhập nội dung').trim().min(1, 'Cần nhập nội dung').max(2000, 'Nội dung tối đa 2000 ký tự'),
});

export type UpdateAutomationBody = z.infer<typeof updateAutomationBodySchema>;
export type ReportInsightBody = z.infer<typeof reportInsightBodySchema>;
export type MaintenanceAnnounceBody = z.infer<typeof maintenanceAnnounceBodySchema>;
