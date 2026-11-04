import type { AttendanceStatus, SupportCategory } from '../constants/enums';
import type { CheckoutItemInput } from '../schemas/checkout';
import type { Ref } from './api';

export interface SupportDraft {
  category: SupportCategory;
  subject: string;
  description: string;
}

export type AssistantAction =
  | { type: 'SUPPORT_REQUEST'; draft: SupportDraft }
  | { type: 'CART_ITEM'; item: CheckoutItemInput; title: string; subtotal: number; total: number }
  | {
      type: 'ATTENDANCE';
      sessionId: string;
      title: string;
      records: { accountId: string; name: string; status: AttendanceStatus }[];
    };

export type AssistantActionType = AssistantAction['type'];

export interface AssistantQuota {
  used: number;
  limit: number;
  resetsOn: string;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
  sources: string[];
  quota: AssistantQuota | null;
}

export type AssistantStreamEvent =
  | { type: 'status'; text: string }
  | { type: 'done'; result: AssistantReply }
  | { type: 'error'; code: string; message: string };

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
  pendingSessions: number;
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
