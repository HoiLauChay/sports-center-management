import type { AttendanceStatus, SupportCategory } from '../constants/enums';
import type { CheckoutItemInput } from '../schemas/checkout';
import type { Ref } from './api';

/** A support request the assistant wrote from the chat; the member reviews and sends it themselves. */
export interface SupportDraft {
  category: SupportCategory;
  subject: string;
  description: string;
}

/**
 * Something the assistant prepared but never did. The person confirms it in the chat, and the page then calls the
 * same API it would without the assistant, so every usual check (price, availability, permissions) still runs.
 */
export type AssistantAction =
  | { type: 'SUPPORT_REQUEST'; draft: SupportDraft }
  /** A service for the member's cart; paying still goes through the cart. */
  /** `subtotal` is the list price; `total` is what the member pays after their membership benefits. */
  | { type: 'CART_ITEM'; item: CheckoutItemInput; title: string; subtotal: number; total: number }
  /** A coach's attendance for one session, everyone on the roster included. */
  | {
      type: 'ATTENDANCE';
      sessionId: string;
      title: string;
      records: { accountId: string; name: string; status: AttendanceStatus }[];
    };

export type AssistantActionType = AssistantAction['type'];

/** A member's questions this month; staff have no quota. */
export interface AssistantQuota {
  used: number;
  limit: number;
  /** The first day of next month (YYYY-MM-DD), when `used` starts again from 0. */
  resetsOn: string;
}

export interface AssistantReply {
  reply: string;
  actions: AssistantAction[];
  quota: AssistantQuota | null;
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
