import type {
  ApiResponse,
  AssistantQuota,
  AssistantQuotaPage,
  AssistantQuotaReset,
  ListAssistantQuotasQuery,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

/** Manager: members' AI assistant questions this month. */
export const assistantQuotasService = {
  list: async (params: ListAssistantQuotasQuery) => {
    const { data } = await privateApi.get<ApiResponse<AssistantQuotaPage>>('/assistant/quotas', { params });
    return data.result;
  },

  ofMember: async (accountId: string) => {
    const { data } = await privateApi.get<ApiResponse<AssistantQuota>>(`/assistant/quotas/${accountId}`);
    return data.result;
  },

  /** One member's questions this month, or every member's when `accountId` is left out. */
  reset: async (accountId?: string) => {
    const { data } = await privateApi.post<ApiResponse<AssistantQuotaReset>>(
      accountId ? `/assistant/quotas/${accountId}/reset` : '/assistant/quota/reset',
    );
    return data.result;
  },
};
