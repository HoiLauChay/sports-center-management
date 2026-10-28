import type {
  ApiResponse,
  AssistantChatBody,
  AssistantOverview,
  AssistantQuota,
  AssistantReply,
} from '@sports-center/shared';
import { privateApi } from '~/lib/http';

export const assistantService = {
  /** One answer may take a few rounds of tool calls on the server, well past the default 15s timeout. */
  chat: async (body: AssistantChatBody) => {
    const { data } = await privateApi.post<ApiResponse<AssistantReply>>('/assistant/chat', body, { timeout: 90_000 });
    return data.result;
  },

  quota: async () => {
    const { data } = await privateApi.get<ApiResponse<AssistantQuota | null>>('/assistant/quota');
    return data.result;
  },

  overview: async () => {
    const { data } = await privateApi.get<ApiResponse<AssistantOverview>>('/assistant/overview');
    return data.result;
  },
};
