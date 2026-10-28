import type { AnnouncementKind, Gender, ProgressMilestone } from '../constants/enums';
import type { MyAttendance } from './attendance';
import type { Person } from './audit';
import type { ClassSession } from './class';

export interface SessionNote {
  title: string;
  content: string;
  homework: string | null;
  attachments: string[];
  updatedAt: string;
}

export interface Evaluation {
  id: string;
  session: ClassSession;
  account: Person;
  coach: Person;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface ClassAnnouncement {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  sender: Person;
  createdAt: string;
}

export interface AnnouncementResult extends ClassAnnouncement {
  recipients: number;
}

export interface TrainingPlan {
  account: Person | null;
  goals: string;
  content: string;
  updatedBy: Person;
  updatedAt: string;
}

/** An AI-written draft of a plan; the coach edits it before saving (never saved by itself). */
export interface TrainingPlanSuggestion {
  goals: string;
  content: string;
}

export interface ProgressReview {
  account: Person;
  milestone: ProgressMilestone;
  technique: number;
  fitness: number;
  attitude: number;
  comment: string;
  coach: Person;
  createdAt: string;
  updatedAt: string;
}

export interface RosterEntry {
  account: Person & { phone: string | null; dateOfBirth: string | null; gender: Gender | null };
  enrolledAt: string;
  fitnessGoals: string | null;
  healthNotes: string | null;
  emergencyContact: string | null;
  attendance: { present: number; late: number; absent: number; unmarked: number };
  lastResult: { sessionNumber: number; rating: number } | null;
  planUpdatedAt: string | null;
  reviews: ProgressMilestone[];
}

export interface StudentProgress {
  attendance: MyAttendance[];
  results: Evaluation[];
  plan: TrainingPlan | null;
  reviews: ProgressReview[];
}

export interface ClassPlans {
  classPlan: TrainingPlan | null;
  memberPlans: TrainingPlan[];
}

export interface MyClassTraining {
  classPlan: TrainingPlan | null;
  myPlan: TrainingPlan | null;
  reviews: ProgressReview[];
  announcements: ClassAnnouncement[];
}
