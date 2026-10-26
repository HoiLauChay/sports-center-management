import { ATTENDANCE_RULES, type ClassSession, type ProgressMilestone } from '@sports-center/shared';
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
    return `Đã quá ${ATTENDANCE_RULES.COACH_EDIT_DAYS} ngày sau buổi học, chỉ quản lý sửa được điểm danh.`;
  }
  return null;
}

export const MILESTONE_LABEL: Record<ProgressMilestone, string> = { MID: 'Giữa khóa', FINAL: 'Cuối khóa' };

/** Which progress reviews are open for a class (BR_4.9): mid once half the sessions started, final from the last day. */
export function reachedMilestones(sessions: ClassSession[]): Record<ProgressMilestone, boolean> {
  const scheduled = sessions.filter((session) => session.status === 'SCHEDULED');
  const started = scheduled.filter((session) => isPast(session.date, session.startTime)).length;
  const last = scheduled.at(-1);
  return {
    MID: scheduled.length > 0 && started >= Math.ceil(scheduled.length / 2),
    FINAL: Boolean(last && todayVN() >= last.date),
  };
}
