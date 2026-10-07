import { DAY_SHORT, WEEK_ORDER, todayVN } from '~/lib/time';
import type { ClassDerivedStatus, ClassStatus, CoachRegistrationStatus, GymClass, WeeklySlot } from './types';

export function weeklyText(schedule: WeeklySlot[]) {
  const first = schedule[0];
  if (!first) return '—';
  const days = WEEK_ORDER.filter((day) => schedule.some((slot) => slot.dayOfWeek === day))
    .map((day) => DAY_SHORT[day])
    .join('/');
  return `${days} · ${first.startTime}–${first.endTime}`;
}

export const CLASS_STATUS_TAG: Record<ClassStatus, { label: string; color?: string }> = {
  DRAFT: { label: 'Nháp' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'warning' },
  OPEN: { label: 'Đang mở', color: 'success' },
  CANCELLED: { label: 'Đã hủy', color: 'error' },
};

export const CLASS_PHASE_TAG: Record<ClassDerivedStatus, { label: string; color?: string }> = {
  UPCOMING: { label: 'Sắp khai giảng', color: 'processing' },
  ONGOING: { label: 'Đang học', color: 'success' },
  COMPLETED: { label: 'Đã kết thúc' },
};

/** The status a manager sees for a class: the stored one, refined by the derived phase once the class is open. */
export function classStatusTag(item: Pick<GymClass, 'status' | 'derivedStatus'>) {
  return item.status === 'OPEN' && item.derivedStatus
    ? CLASS_PHASE_TAG[item.derivedStatus]
    : CLASS_STATUS_TAG[item.status];
}

export const REGISTRATION_TAG: Record<CoachRegistrationStatus, { label: string; color?: string }> = {
  PENDING: { label: 'Chờ chọn', color: 'warning' },
  APPROVED: { label: 'Đã chọn', color: 'success' },
  REJECTED: { label: 'Từ chối' },
};

export interface ClassAdminActions {
  edit: boolean;
  override: boolean;
  assignCoach: boolean;
  approve: boolean;
  reject: boolean;
  cancel: boolean;
  /** Sessions may be changed or cancelled one by one. */
  sessions: boolean;
}

/**
 * Which management actions a class allows in its current state (BR_2.10): editing and the head-count switch only
 * before the first session, coach assignment while the class is a draft or waiting for approval, approval only with
 * a coach, and cancelling any class that is neither cancelled nor over.
 */
export function classAdminActions(item: GymClass): ClassAdminActions {
  const started = item.startDate !== null && todayVN() >= item.startDate;
  const live = item.status !== 'CANCELLED' && item.derivedStatus !== 'COMPLETED';
  const pending = item.status === 'PENDING_APPROVAL';
  return {
    edit: live && !started,
    override: item.status === 'OPEN' && !started,
    assignCoach: item.status === 'DRAFT' || pending,
    approve: pending && item.coach !== null,
    reject: pending,
    cancel: live,
    sessions: live,
  };
}
