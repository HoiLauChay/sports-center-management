import type { ClassDerivedStatus, ClassStatus, EnrollmentStatus } from '../constants/enums';
import type { Ref } from './api';
import type { Person } from './audit';
import type { Course } from './course';

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

export interface ClassSummary {
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

export interface ClassDetail extends ClassSummary {
  sessions: ClassSession[];
}

export interface Enrollment {
  id: string;
  class: Ref;
  account: Person;
  status: EnrollmentStatus;
  paidAmount: number;
  refundedAt: string | null;
  orderItemId: string;
  enrolledAt: string;
}

export interface CancelClassResult {
  class: ClassDetail;
  refundTotal: number;
}

export interface CancelEnrollmentResult {
  enrollment: Enrollment;
  refund: number;
}
