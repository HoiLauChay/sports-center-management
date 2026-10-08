import dayjs from 'dayjs';
import { Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';

function AssistantAvatar() {
  return (
    <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[10px] bg-sc-ink text-sc-lime">
      <Sparkles size={15} />
    </span>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  pending: boolean;
}

export function MessageList({ messages, pending }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending]);

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-sc-border-soft" />
        <span className="rounded-full bg-sc-paper px-2.5 py-0.5 text-[11.5px] font-medium text-sc-muted">
          Hôm nay · {dayjs().format('DD/MM')}
        </span>
        <span className="h-px flex-1 bg-sc-border-soft" />
      </div>

      {messages.map((item) =>
        item.role === 'user' ? (
          <div key={item.id} className="flex flex-col items-end gap-1">
            <div className="max-w-[min(520px,85%)] rounded-[18px_18px_6px_18px] bg-sc-ink px-4 py-2.5 text-[14px] leading-5 whitespace-pre-line text-white [overflow-wrap:anywhere]">
              {item.content}
            </div>
            <span className="text-[11px] text-sc-muted-2">{dayjs(item.createdAt).format('HH:mm')}</span>
          </div>
        ) : (
          <div key={item.id} className="flex gap-3">
            <AssistantAvatar />
            <div className="flex max-w-[600px] min-w-0 flex-col gap-1">
              <p className="m-0 text-[14.5px] leading-[22px] whitespace-pre-line text-sc-ink-2 [overflow-wrap:anywhere]">
                {item.content}
              </p>
              <span className="text-[11px] text-sc-muted-2">{dayjs(item.createdAt).format('HH:mm')}</span>
            </div>
          </div>
        ),
      )}

      {pending && (
        <div className="flex gap-3">
          <AssistantAvatar />
          <span
            className="flex items-center gap-1 rounded-xl bg-sc-paper px-3 py-2.5"
            role="status"
            aria-label="Trợ lý đang trả lời"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-[7px] animate-bounce rounded-full bg-sc-muted"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
