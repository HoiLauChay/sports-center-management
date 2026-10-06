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
  minStudentsOverride: boolean;
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

/** `GET /me/enrollments`: the enrollment with its full class. */
export interface MyEnrollment extends Omit<Enrollment, 'class'> {
  class: GymClass;
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

export interface ClassStudent {
  id: string;
  fullName: string;
  status: 'ENROLLED' | 'CANCELLED';
  /** Empty for the students that were enrolled before this browser's mock orders. */
  enrolledAt: string | null;
  paidAmount: number;
  refundedAmount: number;
}

/** `GET /classes/{id}` for a manager: the class, sessions, students, revenue and coach registrations. */
export interface ClassAdminDetail extends GymClassDetail {
  coachRegistrations: CoachRegistration[];
  students: ClassStudent[];
  /** Paid enrollment lines and what is left after refunds. */
  revenue: { lines: number; total: number };
}

export interface SessionPatch {
  date?: string;
  startTime?: string;
  endTime?: string;
  facilityId?: string;
}

export interface ClassPatch {
  name?: string;
  minStudents?: number;
  maxStudents?: number;
}

/** What cancelling a class (or one session) would give back, shown before the manager confirms. */
export interface RefundPreview {
  students: number;
  amount: number;
}
