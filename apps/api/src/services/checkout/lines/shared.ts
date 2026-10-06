import type { ScheduleClashReason } from '@sports-center/shared';

import type { CheckoutContext, LineError } from '~/services/checkout/types';
import type { TimeRange } from '~/services/schedule.service';
import { overlaps } from '~/utils/time';

export const CLASH_MESSAGE: Record<ScheduleClashReason, string> = {
  CLOSED: 'Cơ sở đang tạm ngừng hoạt động',
  PAST: 'Khung giờ đã qua',
  OFF_GRID: 'Khung giờ không khớp lưới slot',
  MAINTENANCE: 'Cơ sở bảo trì trong khung giờ này',
  CLASS_SESSION: 'Khung giờ đã có lớp học',
  BOOKED: 'Khung giờ đã hết chỗ',
  FULL: 'Khung giờ đã hết chỗ',
  COACH_BUSY: 'Huấn luyện viên đã có lịch trùng giờ',
  MEMBER_BUSY: 'Người mua đã có lịch khác trùng giờ',
};

export const lineError = (code: LineError['code'], message: string) => ({
  ok: false as const,
  error: { code, message },
});

export const busyInOrder = (ctx: CheckoutContext, ranges: TimeRange[]) =>
  ctx.buyer.kind === 'MEMBER' &&
  ctx.planned.some(({ uses }) =>
    uses.some((use) => ranges.some((range) => use.date === range.date && overlaps(use, range))),
  );
