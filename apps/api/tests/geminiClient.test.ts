import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';

import { env } from '~/configs/env';
import geminiClient, { type ChatInput } from '~/services/ai/gemini.client';

const input: ChatInput = { system: 'Quy tắc', contents: [{ role: 'user', parts: [{ text: 'Chào' }] }], tools: [] };
const answer = () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Chào bạn' }] } }] }));

describe('Gemini chat', () => {
  const key = env.GEMINI_API_KEY;
  let send: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

  beforeEach(() => {
    env.GEMINI_API_KEY = 'test-key';
    send = spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    env.GEMINI_API_KEY = key;
    send.mockRestore();
  });

  test('turns tools off only for a turn that must answer', async () => {
    send.mockImplementation((async () => answer()) as unknown as typeof fetch);
    await geminiClient.chat(input);
    await geminiClient.chat({ ...input, answerOnly: true });

    const bodies = send.mock.calls.map(([, init]) => JSON.parse(init!.body as string) as Record<string, unknown>);
    expect(bodies[0]).not.toHaveProperty('toolConfig');
    expect(bodies[1]).toMatchObject({ toolConfig: { functionCallingConfig: { mode: 'NONE' } } });
  });

  test('says the answer took too long once its deadline has passed', async () => {
    send.mockImplementation((async (_url: string, init: RequestInit) => {
      init.signal!.throwIfAborted();
      return answer();
    }) as typeof fetch);

    await expect(geminiClient.chat({ ...input, signal: AbortSignal.abort() })).rejects.toThrow('quá lâu');
  });

  test('does not retry an overloaded Gemini past the deadline', async () => {
    const deadline = new AbortController();
    send.mockImplementation((async () => {
      deadline.abort();
      return new Response('', { status: 503 });
    }) as unknown as typeof fetch);

    await expect(geminiClient.chat({ ...input, signal: deadline.signal })).rejects.toThrow('quá lâu');
    expect(send).toHaveBeenCalledTimes(1);
  });
});
