import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useCurrentUser } from '~/features/auth';
import { assistantService } from '../services/assistant.service';
import type { AssistantContext, ChatMessage, ChatRole } from '../types';

const RECENT_LIMIT = 5;
const recentKey = (userId: string) => `sc.assistant.recent.${userId}`;

function readRecent(userId: string): string[] {
  try {
    const raw = localStorage.getItem(recentKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function message(role: ChatRole, content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() };
}

/** One conversation in memory; the last questions asked are kept per account in `localStorage`. */
export function useAssistantChat(context: AssistantContext) {
  const user = useCurrentUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recent, setRecent] = useState<string[]>(() => readRecent(user.id));

  const ask = useMutation({
    mutationFn: (question: string) => assistantService.ask(question, context),
    onSuccess: (reply) => setMessages((list) => [...list, message('assistant', reply)]),
    onError: () =>
      setMessages((list) => [
        ...list,
        message('assistant', 'Xin lỗi, mình chưa trả lời được lúc này. Bạn thử lại sau ít phút nhé.'),
      ]),
  });

  const remember = (question: string) => {
    const next = [question, ...recent.filter((item) => item !== question)].slice(0, RECENT_LIMIT);
    setRecent(next);
    try {
      localStorage.setItem(recentKey(user.id), JSON.stringify(next));
    } catch {
      // Storage may be unavailable (private mode); the list just won't persist.
    }
  };

  const send = (text: string) => {
    const question = text.trim();
    if (!question || ask.isPending) return;
    setMessages((list) => [...list, message('user', question)]);
    remember(question);
    ask.mutate(question);
  };

  const reset = () => {
    setMessages([]);
    ask.reset();
  };

  return { messages, recent, send, reset, pending: ask.isPending };
}
