import { ASSISTANT_MAX_MESSAGES, ERROR_CODE } from '@sports-center/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUser } from '~/features/auth';
import { describeApiError, toApiError } from '~/lib/http-errors';
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

const quotaKey = (userId: string) => ['assistant', 'quota', userId] as const;

export function useAssistantQuota() {
  const user = useCurrentUser();
  return useQuery({ queryKey: quotaKey(user.id), queryFn: assistantService.quota });
}

export function useAssistantChat() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations(user.id));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
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
      return [updated, ...list.filter(({ id }) => id !== conversationId)].slice(0, MAX_CONVERSATIONS);
    });
  }, []);

  const ask = useMutation({
    mutationFn: ({ conversationId, history }: { conversationId: string; history: ChatMessage[] }) =>
      assistantService.chat(
        {
          conversationId,
          messages: history
            .filter(({ failed }) => !failed)
            .slice(-ASSISTANT_MAX_MESSAGES)
            .map(({ role, text }) => ({ role, text })),
        },
        setStatus,
      ),
    onSettled: () => setStatus(null),
    onSuccess: ({ reply, actions, sources, quota }, { conversationId }) => {
      queryClient.setQueryData(quotaKey(user.id), quota);
      append(conversationId, { id: newId(), role: 'model', text: reply, actions, sources });
    },
    onError: (error, { conversationId }) => {
      if (toApiError(error).code === ERROR_CODE.AI_QUOTA_EXCEEDED) {
        void queryClient.invalidateQueries({ queryKey: quotaKey(user.id) });
      }
      append(conversationId, { id: newId(), role: 'model', text: describeApiError(error), failed: true });
    },
  });

  const markDone = (conversationId: string, messageId: string, index: number) =>
    setConversations((list) =>
      list.map((conversation) =>
        conversation.id !== conversationId
          ? conversation
          : {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId
                  ? { ...message, doneActions: [...(message.doneActions ?? []), index] }
                  : message,
              ),
            },
      ),
    );

  const send = (text: string) => {
    const question = text.trim();
    if (!question || ask.isPending) return;
    const conversationId = active?.id ?? newId();
    const message: ChatMessage = { id: newId(), role: 'user', text: question };
    append(conversationId, message);
    setActiveId(conversationId);
    ask.mutate({ conversationId, history: [...(active?.messages ?? []), message] });
  };

  const retry = () => {
    if (!active?.messages.at(-1)?.failed || ask.isPending) return;
    const messages = active.messages.filter(({ failed }) => !failed);
    setConversations((list) => list.map((item) => (item.id === active.id ? { ...item, messages } : item)));
    ask.mutate({ conversationId: active.id, history: messages });
  };

  const remove = (conversationId: string) => {
    setConversations((list) => list.filter(({ id }) => id !== conversationId));
    if (conversationId === activeId) setActiveId(null);
    void assistantService.forget(conversationId).catch(() => undefined);
  };

  return {
    conversations,
    active,
    pending: ask.isPending,
    status,
    send,
    retry,
    open: setActiveId,
    startNew: () => setActiveId(null),
    remove,
    markDone,
  };
}
