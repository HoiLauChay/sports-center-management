import { ATTENDANCE_RULES } from '@sports-center/shared';
import { addDays, fromMinutes, isPast, todayVN, toMinutes } from '~/lib/time';

export type SessionPhase = 'UPCOMING' | 'LIVE' | 'DONE';

interface Timed {
  date: string;
  startTime: string;
  endTime: string;
}

export const SESSION_PHASE_TAG: Record<SessionPhase, { label: string; color?: string }> = {
  UPCOMING: { label: 'Sắp diễn ra', color: 'processing' },
  LIVE: { label: 'Đang diễn ra', color: 'success' },
  DONE: { label: 'Đã diễn ra' },
};

export function sessionPhase({ date, startTime, endTime }: Timed): SessionPhase {
  if (!isPast(date, startTime)) return 'UPCOMING';
  return isPast(date, endTime) ? 'DONE' : 'LIVE';
}

/** Why the coach cannot save attendance right now, or null inside the window (BR_4.2). */
export function attendanceLockReason({ date, startTime }: Timed): string | null {
  const opensAt = fromMinutes(Math.max(toMinutes(startTime) - ATTENDANCE_RULES.OPENS_MINUTES_BEFORE, 0));
  if (!isPast(date, opensAt)) {
    return `Điểm danh mở lúc ${opensAt}, ${ATTENDANCE_RULES.OPENS_MINUTES_BEFORE} phút trước giờ học.`;
  }
  if (todayVN() > addDays(date, ATTENDANCE_RULES.COACH_EDIT_DAYS)) {
    return `Đã quá ${ATTENDANCE_RULES.COACH_EDIT_DAYS} ngày sau buổi học. Liên hệ quản lý nếu cần sửa điểm danh.`;
  }
  return null;
}
