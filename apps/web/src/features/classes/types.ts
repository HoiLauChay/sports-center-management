import type { Person, Ref } from '@sports-center/shared';

export interface Course {
  id: string;
  name: string;
  description: string | null;
  sport: Ref;
  totalSessions: number;
  price: number;
  thumbnailUrl: string | null;
}

export type ClassStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'OPEN' | 'CANCELLED';
export type ClassDerivedStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED';

export interface WeeklySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ClassSession {
  id: string;
  classId: string;
  sessionNumber: number;
  date: string;
  startTime: string;
  endTime: string;
  facility: Ref;
  status: 'SCHEDULED' | 'CANCELLED';
  cancelReason: string | null;
}

export interface GymClass {
  id: string;
  name: string;
  course: Course;
  status: ClassStatus;
  derivedStatus: ClassDerivedStatus | null;
  startDate: string | null;
  endDate: string | null;
  weeklySchedule: WeeklySlot[];
  facility: Ref;
  coach: Person | null;
  minStudents: number;
  maxStudents: number;
  enrolledCount: number;
  cancelReason: string | null;
}

export interface GymClassDetail extends GymClass {
  sessions: ClassSession[];
}

export interface Enrollment {
  id: string;
  class: Ref;
  account: Person;
  status: 'ENROLLED' | 'CANCELLED';
  paidAmount: number;
  refundedAmount: number;
  orderItemId: string;
  enrolledAt: string;
}

export type CoachRegistrationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface CoachRegistration {
  id: string;
  classId: string;
  coach: Person;
  status: CoachRegistrationStatus;
  source: 'COACH_REGISTERED' | 'MANAGER_ASSIGNED';
  createdAt: string;
  /** Open classes this coach already teaches (shown to help the manager choose). */
  activeClasses?: number;
}

/** `GET /classes/{id}` for a manager: the class, its sessions and coach registrations. */
export interface ClassAdminDetail extends GymClassDetail {
  coachRegistrations: CoachRegistration[];
}

export interface SessionPatch {
  date?: string;
  startTime?: string;
  endTime?: string;
  facilityId?: string;
}
