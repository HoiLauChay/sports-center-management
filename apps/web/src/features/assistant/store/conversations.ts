import type { AssistantAction } from '@sports-center/shared';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** What the assistant prepared for the person to confirm, shown as cards under the answer. */
  actions?: AssistantAction[];
  /** Indexes of `actions` already confirmed, so a reopened chat does not offer them again. */
  doneActions?: number[];
  /** A failed answer: shown with a retry button and never sent back to the assistant. */
  failed?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES = 60;
const keyOf = (userId: string) => `sc-assistant:${userId}`;

/** Past chats live only in this browser, per account; the server keeps none. Storage may be unavailable. */
export function loadConversations(userId: string): Conversation[] {
  try {
    const raw = window.localStorage.getItem(keyOf(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Conversation[]).slice(0, MAX_CONVERSATIONS) : [];
  } catch {
    return [];
  }
}

export function saveConversations(userId: string, conversations: Conversation[]) {
  try {
    const trimmed = conversations
      .filter(({ messages }) => messages.length > 0)
      .slice(0, MAX_CONVERSATIONS)
      .map((conversation) => ({ ...conversation, messages: conversation.messages.slice(-MAX_MESSAGES) }));
    window.localStorage.setItem(keyOf(userId), JSON.stringify(trimmed));
  } catch {
    // Private mode or full storage: the chat still works, it just is not remembered.
  }
}
