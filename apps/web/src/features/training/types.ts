import type { Person, Ref } from '@sports-center/shared';
import type { ClassSession } from '~/features/classes/types';

export const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_TAG: Record<AttendanceStatus, { label: string; color?: string }> = {
  PRESENT: { label: 'Có mặt', color: 'success' },
  LATE: { label: 'Muộn', color: 'warning' },
  ABSENT: { label: 'Vắng', color: 'error' },
};

/** `$ATTENDANCE`: one student of a session; `status` is `null` until the coach marks them. */
export interface AttendanceRecord {
  account: Person;
  status: AttendanceStatus | null;
  note: string | null;
  updatedBy: Person | null;
  updatedAt: string | null;
}

export interface AttendanceInput {
  accountId: string;
  status: AttendanceStatus;
  note?: string;
}

/** `$SESSION_NOTE`: at most one per session (BR_4.4). */
export interface SessionNote {
  title: string;
  content: string;
  attachments: string[];
  updatedAt: string;
}

export interface SessionNoteInput {
  title: string;
  content: string;
  attachments?: string[];
}

/** `$EVALUATION`: rating 1-5 and a comment for one student in one session. */
export interface Evaluation {
  id: string;
  session: ClassSession;
  account: Person;
  coach: Person;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface EvaluationInput {
  accountId: string;
  rating: number;
  comment?: string;
}

export interface Announcement {
  id: string;
  classId: string;
  title: string;
  body: string;
  recipients: number;
  createdAt: string;
}

/** A session together with the class it belongs to, as the coach's session page needs it. */
export interface TrainingSession {
  session: ClassSession;
  class: Ref & { sport: Ref; coach: Person | null };
  /** Students that belong to this session (enrolled by the session date, BR_4.2). */
  studentCount: number;
}

/** `GET /me/attendance`: one row per session of a class I joined. */
export interface MyAttendanceRow {
  session: ClassSession;
  status: AttendanceStatus | null;
  note: string | null;
}

export type CheckInBasis = 'BOOKING' | 'CLASS_SESSION' | 'MEMBERSHIP';

export const CHECKIN_BASIS_LABEL: Record<CheckInBasis, string> = {
  BOOKING: 'Booking',
  CLASS_SESSION: 'Buổi học',
  MEMBERSHIP: 'Gói gym',
};

/** The sentence after "Đủ điều kiện:" when a member is allowed in. */
export const CHECKIN_BASIS_REASON: Record<CheckInBasis, string> = {
  BOOKING: 'có booking hôm nay',
  CLASS_SESSION: 'có buổi học hôm nay',
  MEMBERSHIP: 'gói thành viên có quyền vào gym',
};

export interface CheckIn {
  id: string;
  account: Person;
  checkedInAt: string;
  basis: CheckInBasis;
  by: Person;
}

/** Why a member can (or cannot) be checked in right now (BR_4.1). */
export interface CheckInCheck {
  member: Person & { status: string; phone: string | null };
  eligible: boolean;
  basis: CheckInBasis | null;
  /** Human reasons shown when the member cannot be checked in. */
  reasons: string[];
  bookingsToday: { id: string; facility: Ref; startTime: string; endTime: string }[];
  sessionsToday: { id: string; className: string; facility: Ref; startTime: string; endTime: string }[];
  gymAccess: boolean;
  lastCheckInToday: string | null;
}
