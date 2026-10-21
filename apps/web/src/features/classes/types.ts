import type { ClassDetail, CoachRegistration } from '@sports-center/shared';

export type {
  ClassDerivedStatus,
  ClassSession,
  ClassStatus,
  ClassSummary,
  CoachRegistration,
  CoachRegistrationStatus,
  WeeklySlot,
} from '@sports-center/shared';

/** `GET /classes/{id}` for a manager, with coach registrations always present. */
export type ClassAdminDetail = ClassDetail & { coachRegistrations: CoachRegistration[] };
