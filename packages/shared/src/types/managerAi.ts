import type { SupportCategory } from '../constants/enums';
import type { AutomationKey } from '../schemas/managerAi';
import type { Ref } from './api';
import type { Person } from './audit';

/** Every AI text says whether AI wrote it or the plain fallback template did. */
export interface AiText {
  text: string;
  ai: boolean;
  generatedAt: string;
}

export interface ClassReviewCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface ClassReviewInsight {
  summary: string;
  recommendation: 'APPROVE' | 'REJECT' | 'REVIEW';
  checks: ClassReviewCheck[];
  ai: boolean;
}

export interface BankMatchCandidate {
  account: Person & { phone: string | null; email: string | null };
  score: number;
  reasons: string[];
}

export interface BankMatchSuggestions {
  candidates: BankMatchCandidate[];
}

export interface MaintenanceNoticeDraft {
  title: string;
  message: string;
  recipients: number;
  ai: boolean;
}

export interface MaintenanceAnnounceResult {
  sent: number;
}

export const SUPPORT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export interface SupportTriage {
  category: SupportCategory;
  priority: SupportPriority;
  summary: string;
  reply: string;
  ai: boolean;
}

export interface PromoSuggestion {
  facility: Ref;
  weekday: number;
  startTime: string;
  endTime: string;
  occupancyPct: number;
  discountPct: number;
}

export interface DigestHighlight {
  label: string;
  value: string;
  /** Percent change against the week before; null when there is nothing to compare. */
  change: number | null;
}

export interface WeeklyDigest extends AiText {
  from: string;
  to: string;
  highlights: DigestHighlight[];
  promos: PromoSuggestion[];
}

export interface AutomationSetting {
  key: AutomationKey;
  enabled: boolean;
  threshold: number | null;
  lastRunAt: string | null;
  updatedAt: string | null;
}
