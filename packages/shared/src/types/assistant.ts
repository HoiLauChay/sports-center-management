import type { SupportCategory } from '../constants/enums';
import type { Ref } from './api';

/** A support request the assistant wrote from the chat; the member reviews and sends it themselves. */
export interface SupportDraft {
  category: SupportCategory;
  subject: string;
  description: string;
}

export interface AssistantReply {
  reply: string;
  supportDraft: SupportDraft | null;
}

/** What the assistant can see about the member, shown beside the chat. */
export interface MemberAssistantOverview {
  role: 'MEMBER';
  membership: { name: string; startDate: string; endDate: string; daysLeft: number } | null;
  classes: Ref[];
  nextSession: { date: string; startTime: string; className: string; facility: string } | null;
  homework: { classId: string; className: string; sessionNumber: number; date: string; text: string }[];
}

export interface CoachAssistantOverview {
  role: 'COACH';
  classes: (Ref & { enrolled: number; maxStudents: number })[];
  todaySessions: { id: string; startTime: string; endTime: string; className: string; facility: string }[];
  /** Sessions already started in the last two weeks with attendance not fully marked or no note. */
  pendingSessions: number;
  /** Students still waiting for a review whose milestone has been reached. */
  missingReviews: number;
}

export interface ReceptionAssistantOverview {
  role: 'RECEPTIONIST';
  checkinsToday: number;
  bookingsToday: number;
  sessionsToday: { id: string; startTime: string; endTime: string; className: string; facility: string }[];
  openSupport: number;
}

export type AssistantOverview = MemberAssistantOverview | CoachAssistantOverview | ReceptionAssistantOverview;
