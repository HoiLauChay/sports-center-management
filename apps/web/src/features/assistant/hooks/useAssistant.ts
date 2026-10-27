import { ASSISTANT_MAX_MESSAGES } from '@sports-center/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '~/features/auth';
import { describeApiError } from '~/lib/http-errors';
import { assistantService } from '../services/assistant.service';
import {
  loadConversations,
  MAX_CONVERSATIONS,
  saveConversations,
  type ChatMessage,
  type Conversation,
} from '../store/conversations';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const TITLE_LENGTH = 48;

export function useAssistantOverview() {
  const user = useCurrentUser();
  return useQuery({ queryKey: ['assistant', 'overview', user.id], queryFn: assistantService.overview });
}

/** The open conversation and the remembered ones; sends the latest messages and appends the answer. */
export function useAssistantChat() {
  const user = useCurrentUser();
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations(user.id));
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => conversations.find(({ id }) => id === activeId) ?? null, [conversations, activeId]);

  useEffect(() => {
    saveConversations(user.id, conversations);
  }, [user.id, conversations]);

  const append = useCallback((conversationId: string, message: ChatMessage) => {
    setConversations((list) => {
      const current = list.find(({ id }) => id === conversationId);
      const updated: Conversation = current
        ? { ...current, updatedAt: new Date().toISOString(), messages: [...current.messages, message] }
        : {
            id: conversationId,
            title: message.text.length > TITLE_LENGTH ? `${message.text.slice(0, TITLE_LENGTH)}…` : message.text,
            updatedAt: new Date().toISOString(),
            messages: [message],
          };
      // Newest first; the oldest chats beyond the limit are dropped right away, not only when saved.
      return [updated, ...list.filter(({ id }) => id !== conversationId)].slice(0, MAX_CONVERSATIONS);
    });
  }, []);

  const ask = useMutation({
    mutationFn: ({ history }: { conversationId: string; history: ChatMessage[] }) =>
      assistantService.chat({
        messages: history
          .filter(({ failed }) => !failed)
          .slice(-ASSISTANT_MAX_MESSAGES)
          .map(({ role, text }) => ({ role, text })),
      }),
    onSuccess: ({ reply, supportDraft }, { conversationId }) =>
      append(conversationId, { id: newId(), role: 'model', text: reply, supportDraft }),
    onError: (error, { conversationId }) =>
      append(conversationId, { id: newId(), role: 'model', text: describeApiError(error), failed: true }),
  });

  const send = (text: string) => {
    const question = text.trim();
    if (!question || ask.isPending) return;
    const conversationId = active?.id ?? newId();
    const message: ChatMessage = { id: newId(), role: 'user', text: question };
    append(conversationId, message);
    setActiveId(conversationId);
    ask.mutate({ conversationId, history: [...(active?.messages ?? []), message] });
  };

  /** Asks the last question again after a failed answer, dropping the error from the chat. */
  const retry = () => {
    if (!active || ask.isPending) return;
    const messages = active.messages.filter(({ failed }) => !failed);
    setConversations((list) => list.map((item) => (item.id === active.id ? { ...item, messages } : item)));
    ask.mutate({ conversationId: active.id, history: messages });
  };

  const remove = (conversationId: string) => {
    setConversations((list) => list.filter(({ id }) => id !== conversationId));
    if (conversationId === activeId) setActiveId(null);
  };

  return {
    conversations,
    active,
    pending: ask.isPending,
    send,
    retry,
    open: setActiveId,
    startNew: () => setActiveId(null),
    remove,
  };
}
