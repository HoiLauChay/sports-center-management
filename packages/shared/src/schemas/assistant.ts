import { z } from 'zod';

export const ASSISTANT_MAX_MESSAGES = 20;
export const ASSISTANT_MAX_TEXT = 1000;
/** Questions a month for a member without an active membership; a membership sets its own number. */
export const ASSISTANT_FREE_QUESTIONS = 10;
/** Actions the assistant may prepare in one answer. */
export const ASSISTANT_MAX_ACTIONS = 3;

export const ASSISTANT_ROLES = ['MEMBER', 'COACH', 'RECEPTIONIST'] as const;
export type AssistantRole = (typeof ASSISTANT_ROLES)[number];

/**
 * Pages the assistant may link to, per role; `:id` stands for one UUID.
 * Anything else it writes stays plain text in the chat.
 */
export const ASSISTANT_LINKS: Record<AssistantRole, readonly string[]> = {
  MEMBER: [
    '/schedule',
    '/training',
    '/enrollments',
    '/classes',
    '/bookings',
    '/wallet',
    '/wallet/top-up',
    '/memberships',
    '/memberships/mine',
    '/orders',
    '/support',
    '/profile',
  ],
  COACH: [
    '/coach/classes',
    '/coach/classes/:id',
    '/coach/schedule',
    '/coach/sessions/:id',
    '/coach/open-classes',
    '/coach/specializations',
    '/profile',
  ],
  RECEPTIONIST: [
    '/reception/checkin',
    '/reception/order',
    '/reception/top-up',
    '/reception/members',
    '/reception/members/:id',
    '/reception/bookings',
    '/reception/orders',
    '/reception/support',
    '/profile',
  ],
};

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export const isAssistantLink = (role: AssistantRole, path: string) =>
  ASSISTANT_LINKS[role].some((pattern) => new RegExp(`^${pattern.replace(':id', UUID)}$`, 'i').test(path));

/** Only plain text turns come from the browser; tool calls and their results exist only on the server. */
const assistantMessageSchema = z.strictObject(
  {
    role: z.enum(['user', 'model'], 'Vai trò tin nhắn không hợp lệ'),
    text: z
      .string('Tin nhắn không hợp lệ')
      .trim()
      .min(1, 'Tin nhắn không được để trống')
      .max(ASSISTANT_MAX_TEXT, `Tin nhắn tối đa ${ASSISTANT_MAX_TEXT} ký tự`),
  },
  'Tin nhắn không hợp lệ',
);

export const assistantChatBodySchema = z.strictObject({
  messages: z
    .array(assistantMessageSchema, 'Danh sách tin nhắn không hợp lệ')
    .min(1, 'Cần ít nhất một tin nhắn')
    .max(ASSISTANT_MAX_MESSAGES, `Tối đa ${ASSISTANT_MAX_MESSAGES} tin nhắn gần nhất`)
    .refine((messages) => messages.at(-1)?.role === 'user', 'Tin nhắn cuối phải là câu hỏi của bạn'),
});

export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantChatBody = z.infer<typeof assistantChatBodySchema>;
