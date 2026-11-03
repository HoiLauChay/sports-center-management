import type {
  ApiErrorBody,
  ApiResponse,
  AssistantChatBody,
  AssistantOverview,
  AssistantQuota,
  AssistantReply,
  AssistantStreamEvent,
} from '@sports-center/shared';
import { config } from '~/lib/config';
import { privateApi, refreshSession } from '~/lib/http';
import { ApiRequestError, CLIENT_ERROR_CODE } from '~/lib/http-errors';

const CHAT_TIMEOUT_MS = 90_000;

const post = async (body: AssistantChatBody) => {
  try {
    return await fetch(`${config.apiBaseUrl}/assistant/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch (err) {
    throw offline(err);
  }
};

const offline = (err: unknown) =>
  new ApiRequestError(
    err instanceof DOMException && err.name === 'TimeoutError'
      ? { code: CLIENT_ERROR_CODE.TIMEOUT, message: 'Yêu cầu quá thời gian, vui lòng thử lại.' }
      : { code: CLIENT_ERROR_CODE.NETWORK, message: 'Không kết nối được máy chủ, kiểm tra mạng của bạn.' },
  );

const refused = async (response: Response) => {
  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiRequestError({
    status: response.status,
    code: body?.code ?? CLIENT_ERROR_CODE.UNKNOWN,
    message: body?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.',
    errors: body?.errors,
    retryAfter: body?.retryAfter,
  });
};

async function* readEvents(response: Response) {
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += value;
    const messages = buffer.split('\n\n');
    buffer = messages.pop()!;
    for (const message of messages) {
      if (message.startsWith('data: ')) yield JSON.parse(message.slice(6)) as AssistantStreamEvent;
    }
  }
}

export const assistantService = {
  chat: async (body: AssistantChatBody, onStatus: (text: string) => void): Promise<AssistantReply> => {
    let response = await post(body);
    if (response.status === 401) {
      await refreshSession();
      response = await post(body);
    }
    if (!response.ok) throw await refused(response);

    try {
      for await (const event of readEvents(response)) {
        if (event.type === 'status') onStatus(event.text);
        if (event.type === 'done') return event.result;
        if (event.type === 'error') throw new ApiRequestError({ code: event.code, message: event.message });
      }
    } catch (err) {
      throw err instanceof ApiRequestError ? err : offline(err);
    }
    throw offline(null);
  },

  forget: (conversationId: string) => privateApi.delete(`/assistant/context/${conversationId}`),

  quota: async () => {
    const { data } = await privateApi.get<ApiResponse<AssistantQuota | null>>('/assistant/quota');
    return data.result;
  },

  overview: async () => {
    const { data } = await privateApi.get<ApiResponse<AssistantOverview>>('/assistant/overview');
    return data.result;
  },
};
