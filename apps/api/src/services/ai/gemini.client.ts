import { ERROR_CODE } from '@sports-center/shared';
import { setTimeout as sleep } from 'node:timers/promises';

import { env } from '~/configs/env';
import { HTTP_STATUS } from '~/constants/httpStatus';
import { ErrorWithStatus } from '~/rules/error';

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const TIMEOUT_MS = 50_000;
const RETRY_DELAY_MS = 1500;

/** The subset of Gemini's schema format (an OpenAPI 3 schema) this app uses. */
export type GeminiSchema =
  | { type: 'STRING'; description?: string; enum?: string[]; format?: 'date' }
  | { type: 'ARRAY'; items: GeminiSchema; description?: string }
  | { type: 'OBJECT'; properties: Record<string, GeminiSchema>; required: string[]; propertyOrdering?: string[] };

export interface GenerateJsonInput {
  /** Fixed instructions: the role, the rules and the output format. */
  system: string;
  /** This request's data. */
  prompt: string;
  /** Gemini only answers JSON that fits this schema (structured output). */
  schema: GeminiSchema;
  temperature?: number;
}

export interface GeminiPart {
  text?: string;
  /** Set on the model's private reasoning; never shown to the user. */
  thought?: boolean;
  /** Gemini 3 needs this sent back unchanged with the part it came on. */
  thoughtSignature?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/** A tool the model may ask to run (function calling); the app runs it, never the model. */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiSchema & { type: 'OBJECT' };
}

export interface ChatInput {
  system: string;
  contents: GeminiContent[];
  tools: FunctionDeclaration[];
  temperature?: number;
}

export interface ChatTurn {
  /** The model's turn as returned, to append to `contents` unchanged on the next call. */
  content: GeminiContent;
  /** The visible answer; empty when the model only asks for tools. */
  text: string;
  calls: { name: string; args: Record<string, unknown> }[];
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

const unavailable = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.SERVICE_UNAVAILABLE, code: ERROR_CODE.UPSTREAM_UNAVAILABLE, message });

/** Sends one generateContent request; maps network, quota and server errors to messages for the user. */
const generate = async (body: Record<string, unknown>) => {
  if (!env.GEMINI_API_KEY) throw unavailable('Tính năng AI chưa được cấu hình');

  const send = () =>
    fetch(`${API_URL}/${env.GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let response: Response;
  try {
    response = await send();
    // The free tier is often briefly overloaded; one retry usually gets through.
    if (response.status === HTTP_STATUS.SERVICE_UNAVAILABLE) {
      await sleep(RETRY_DELAY_MS);
      response = await send();
    }
  } catch (err) {
    console.error('Gemini request failed:', err);
    throw unavailable('Không kết nối được dịch vụ AI, vui lòng thử lại sau');
  }

  if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
    throw new ErrorWithStatus({
      status: HTTP_STATUS.TOO_MANY_REQUESTS,
      code: ERROR_CODE.RATE_LIMITED,
      message: 'Dịch vụ AI đang hết lượt miễn phí, vui lòng thử lại sau ít phút',
    });
  }
  if (!response.ok) {
    console.error('Gemini responded', response.status, await response.text().catch(() => ''));
    throw unavailable('Dịch vụ AI đang gặp sự cố, vui lòng thử lại sau');
  }

  const data = (await response.json()) as GeminiResponse;
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    console.error('Gemini returned nothing:', data.promptFeedback?.blockReason, data.candidates?.[0]?.finishReason);
    throw unavailable('AI không đưa ra được câu trả lời, vui lòng thử lại');
  }
  return parts;
};

const visibleText = (parts: GeminiPart[]) =>
  parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
    .trim();

class GeminiClient {
  /** Calls Gemini's generateContent and returns its answer parsed as JSON; the caller still validates the shape. */
  generateJson = async ({ system, prompt, schema, temperature = 0.7 }: GenerateJsonInput): Promise<unknown> => {
    const parts = await generate({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    });
    const text = visibleText(parts);
    try {
      return JSON.parse(text);
    } catch {
      console.error('Gemini returned invalid JSON:', text.slice(0, 500));
      throw unavailable('AI trả về dữ liệu không hợp lệ, vui lòng thử lại');
    }
  };

  /** One turn of a conversation with tools: either the answer, or the tools the model wants run first. */
  chat = async ({ system, contents, tools, temperature = 0.4 }: ChatInput): Promise<ChatTurn> => {
    const parts = await generate({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature },
    });
    return {
      content: { role: 'model', parts },
      text: visibleText(parts),
      calls: parts.flatMap(({ functionCall }) =>
        functionCall ? [{ name: functionCall.name, args: functionCall.args ?? {} }] : [],
      ),
    };
  };
}

export default new GeminiClient();
