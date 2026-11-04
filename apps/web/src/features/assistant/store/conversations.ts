import type { AssistantAction } from '@sports-center/shared';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  actions?: AssistantAction[];
  doneActions?: number[];
  sources?: string[];
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
    return true;
  } catch {
    return false;
  }
}
