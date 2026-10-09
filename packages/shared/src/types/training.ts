import type { Person } from './audit';
import type { ClassSession } from './class';

export interface SessionNote {
  title: string;
  content: string;
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

export interface AnnouncementResult {
  recipients: number;
}
