import { isAssistantLink, type AssistantRole, type SupportDraft } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button } from 'antd';
import { RotateCcw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChatMessage } from '../store/conversations';
import { ActionCards } from './ActionCards';

const LINK = /\[([^\]\n]{1,60})\]\((\/[a-z0-9/-]*)\)/g;

/** Plain text with the assistant's `[Tên trang](/duong-dan)` links; only allowed internal paths become links. */
function withLinks(text: string, role: AssistantRole): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    const [whole, label, path] = match;
    nodes.push(text.slice(last, match.index));
    nodes.push(
      isAssistantLink(role, path!) ? (
        <Link key={match.index} to={path} className="font-semibold !text-sc-primary underline underline-offset-2">
          {label}
        </Link>
      ) : (
        label
      ),
    );
    last = match.index + whole.length;
  }
  nodes.push(text.slice(last));
  return nodes;
}

interface MessageBubbleProps {
  message: ChatMessage;
  role: AssistantRole;
  onRetry: () => void;
  onOpenDraft: (draft: SupportDraft) => void;
  onActionDone: (messageId: string, index: number) => void;
}

export function MessageBubble({ message, role, onRetry, onOpenDraft, onActionDone }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-sc-ink px-4 py-2.5 text-[15px] whitespace-pre-line text-white [overflow-wrap:anywhere]">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sc-ink text-sc-lime">
        <Sparkles size={16} />
      </span>
      <div className="flex max-w-[85%] min-w-0 flex-col gap-2">
        <div
          className={`rounded-2xl rounded-tl-md border px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] ${
            message.failed
              ? 'border-sc-accent-soft bg-sc-accent-soft text-sc-accent'
              : 'border-sc-border-soft bg-sc-surface text-sc-ink'
          }`}
        >
          {message.failed ? message.text : withLinks(message.text, role)}
        </div>
        {message.failed && (
          <Button size="small" icon={<RotateCcw size={14} />} className="self-start" onClick={onRetry}>
            Thử lại
          </Button>
        )}
        {message.actions && message.actions.length > 0 && (
          <ActionCards
            actions={message.actions}
            doneActions={message.doneActions ?? []}
            onOpenDraft={onOpenDraft}
            onDone={(index) => onActionDone(message.id, index)}
          />
        )}
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sc-ink text-sc-lime">
        <Sparkles size={16} />
      </span>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-sc-border-soft bg-sc-surface px-4 py-3.5">
        <span className="sr-only">Trợ lý đang trả lời</span>
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-sc-muted-2"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
