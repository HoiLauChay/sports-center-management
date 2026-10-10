import type { MemberScheduleItem, Ref } from '@sports-center/shared';

export type ScheduleKind = MemberScheduleItem['kind'];

export type CalendarView = 'week' | 'month';

/** What the calendar draws: one tile per booking or session, whoever it came from. */
export interface CalendarEvent {
  key: string;
  kind: ScheduleKind;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  subtitle?: string;
  cancelled: boolean;
  /** The id the detail page of a class session lives under (`/coach/sessions/{id}`). */
  sessionId?: string;
  classId?: string;
  facility: Ref;
  coach?: string | null;
}
