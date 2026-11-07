import type {
  AiText,
  ApiResponse,
  AutomationKey,
  AutomationSetting,
  BankMatchSuggestions,
  ClassReviewInsight,
  MaintenanceAnnounceBody,
  MaintenanceAnnounceResult,
  MaintenanceNoticeDraft,
  ReportInsightBody,
  SupportTriage,
  UpdateAutomationBody,
  WeeklyDigest,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

/** AI answers can take a while; the default 15s client timeout would cut them off. */
const AI_TIMEOUT_MS = 60_000;

export interface CoachSuggestion {
  coach: { id: string; fullName: string };
  registrationId: string | null;
  score: number;
  reasons: string[];
  available: boolean;
  activeClasses?: number;
}

export interface CoachSuggestions {
  class: { id: string; name: string; sport: string; hasCoach: boolean };
  candidates: CoachSuggestion[];
}

const id = (value: string) => encodeURIComponent(value);

/** `/ai/*`: the AI helpers inside the manager's pages, and the automation switches. */
export const managerAiService = {
  reportInsight: async (body: ReportInsightBody) => {
    const { data } = await privateApi.post<ApiResponse<AiText>>('/ai/reports/insight', body, {
      timeout: AI_TIMEOUT_MS,
    });
    return data.result;
  },

  digest: async () => {
    const { data } = await privateApi.get<ApiResponse<WeeklyDigest>>('/ai/digest', { timeout: AI_TIMEOUT_MS });
    return data.result;
  },

  classReview: async (classId: string) => {
    const { data } = await privateApi.post<ApiResponse<ClassReviewInsight>>(
      `/ai/classes/${id(classId)}/review`,
      undefined,
      { timeout: AI_TIMEOUT_MS },
    );
    return data.result;
  },

  coachSuggestions: async (classId: string) => {
    const { data } = await privateApi.get<ApiResponse<CoachSuggestions>>(
      `/ai/classes/${id(classId)}/coach-suggestions`,
    );
    return data.result;
  },

  bankSuggestions: async (transactionId: string) => {
    const { data } = await privateApi.get<ApiResponse<BankMatchSuggestions>>(
      `/ai/bank-transactions/${id(transactionId)}/suggestions`,
    );
    return data.result.candidates;
  },

  maintenanceNotice: async (maintenanceId: string) => {
    const { data } = await privateApi.post<ApiResponse<MaintenanceNoticeDraft>>(
      `/ai/maintenances/${id(maintenanceId)}/notice`,
      undefined,
      { timeout: AI_TIMEOUT_MS },
    );
    return data.result;
  },

  announceMaintenance: async (maintenanceId: string, body: MaintenanceAnnounceBody) => {
    const { data } = await privateApi.post<ApiResponse<MaintenanceAnnounceResult>>(
      `/ai/maintenances/${id(maintenanceId)}/announce`,
      body,
    );
    return data.result;
  },

  supportTriage: async (requestId: string) => {
    const { data } = await privateApi.post<ApiResponse<SupportTriage>>(
      `/ai/support/${id(requestId)}/triage`,
      undefined,
      {
        timeout: AI_TIMEOUT_MS,
      },
    );
    return data.result;
  },

  automations: async () => {
    const { data } = await privateApi.get<ApiResponse<AutomationSetting[]>>('/ai/automations');
    return data.result;
  },

  updateAutomation: async (key: AutomationKey, body: UpdateAutomationBody) => {
    const { data } = await privateApi.patch<ApiResponse<AutomationSetting>>(`/ai/automations/${key}`, body);
    return data.result;
  },
};
