import type { Person, Ref } from '@sports-center/shared';

export type ScheduleKind = 'BOOKING' | 'CLASS_SESSION';

export interface BookingScheduleEntry {
  kind: 'BOOKING';
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  facility: Ref;
  status: 'CONFIRMED' | 'CANCELLED';
}

export interface ClassSessionScheduleEntry {
  kind: 'CLASS_SESSION';
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  facility: Ref;
  class: { id: string; name: string; coach: Person | null };
  status: 'SCHEDULED' | 'CANCELLED';
}

/** `GET /me/schedule`: my bookings and the sessions of the classes I joined, in time order. */
export type ScheduleEntry = BookingScheduleEntry | ClassSessionScheduleEntry;

/** `GET /coach/schedule`: a session I teach, with its class. */
export interface CoachScheduleEntry {
  id: string;
  classId: string;
  sessionNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  facility: Ref;
  status: 'SCHEDULED' | 'CANCELLED';
  cancelReason: string | null;
  class: Ref;
}

export interface ScheduleRange {
  from: string;
  to: string;
}

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

/** A class session happening on one day, as the reception and manager dashboards list it. */
export interface DaySession {
  id: string;
  classId: string;
  className: string;
  startTime: string;
  endTime: string;
  facility: Ref;
  coach: string | null;
  enrolled: number;
  maxStudents: number;
}
