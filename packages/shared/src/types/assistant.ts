import type { AttendanceStatus, SupportCategory } from '../constants/enums';
import type { CheckoutItemInput } from '../schemas/checkout';
import type { CreateCouponInput } from '../schemas/coupon';
import type { Ref } from './api';
import type { Person } from './audit';

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
    }
  /** Manager: approve or reject a class a coach proposed. */
  | { type: 'CLASS_REVIEW'; classId: string; title: string; decision: 'APPROVE' | 'REJECT'; note: string | null }
  /** Manager: credit an unmatched transfer to the member it most likely came from. */
  | {
      type: 'BANK_MATCH';
      transactionId: string;
      title: string;
      amount: number;
      account: Person & { phone: string | null };
      reasons: string[];
      note: string;
    }
  /** Manager: put a coach on a class that has none. */
  | {
      type: 'ASSIGN_COACH';
      classId: string;
      title: string;
      coach: Person;
      registrationId: string | null;
      reasons: string[];
    }
  /** Manager: a discount code for quiet hours, created only when the manager confirms. */
  | { type: 'CREATE_COUPON'; title: string; reason: string; coupon: CreateCouponInput };

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

export interface ManagerAssistantOverview {
  role: 'MANAGER';
  revenueToday: number;
  bookingsToday: number;
  pendingClasses: number;
  classesNeedingCoach: number;
  unmatchedBankTransactions: number;
  openSupport: number;
  upcomingMaintenances: number;
}

export type AssistantOverview =
  MemberAssistantOverview | CoachAssistantOverview | ReceptionAssistantOverview | ManagerAssistantOverview;
