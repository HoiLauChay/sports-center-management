import type { AssistantRole } from '@sports-center/shared';
import { ASSISTANT_MAX_TEXT } from '@sports-center/shared';
import { Button, Dropdown } from 'antd';
import { ArrowUp, ArrowUpRight, Ellipsis, LifeBuoy, Sparkles, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { AssistantConfig } from '../config';
import type { ChatMessage, Conversation } from '../store/conversations';
import { MessageBubble, TypingBubble } from './MessageBubble';

function Welcome({
  firstName,
  config,
  onAsk,
}: {
  firstName: string;
  config: AssistantConfig;
  onAsk: (question: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center md:py-10">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-sc-ink text-sc-lime shadow-[0_8px_28px_rgba(214,242,75,0.45)]">
        <Sparkles size={26} />
      </span>
      <div className="mt-5 text-[12.5px] font-semibold tracking-[0.12em] text-sc-muted uppercase">
        Trợ lý · Sports Center
      </div>
      <h2 className="m-0 mt-2 font-display text-[30px] leading-tight font-extrabold uppercase md:text-[40px]">
        Chào {firstName}. <span className="rounded-lg bg-sc-lime px-2.5">{config.headline}</span>
      </h2>
      <p className="mt-3 mb-7 text-[15px] text-sc-muted">{config.intro}</p>
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {config.suggestions.map(({ label, question, icon: Icon, tone }) => (
          <button
            key={question}
            type="button"
            onClick={() => onAsk(question)}
            className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-sc-border-soft bg-sc-surface p-4 text-left transition hover:border-sc-border hover:shadow-[0_4px_16px_rgba(20,19,15,0.06)]"
          >
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>
                  <Icon size={16} />
                </span>
                <span className="text-[12.5px] font-semibold tracking-[0.08em] text-sc-muted uppercase">{label}</span>
              </span>
              <ArrowUpRight size={16} className="text-sc-muted-2 group-hover:text-sc-ink" />
            </span>
            <span className="text-[15px] font-medium text-sc-ink">{question}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ChatPanelProps {
  firstName: string;
  role: AssistantRole;
  config: AssistantConfig;
  conversation: Conversation | null;
  pending: boolean;
  onSend: (text: string) => void;
  onRetry: () => void;
  onSupport: (message?: ChatMessage) => void;
}

export function ChatPanel({
  firstName,
  role,
  config,
  conversation,
  pending,
  onSend,
  onRetry,
  onSupport,
}: ChatPanelProps) {
  const [text, setText] = useState('');
  const bottom = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, pending]);

  const submit = (value = text) => {
    if (!value.trim() || pending) return;
    onSend(value);
    setText('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className="flex h-[calc(100dvh-170px)] min-h-[520px] md:h-[calc(100dvh-160px)] md:min-h-[560px] flex-col overflow-hidden rounded-2xl border border-sc-border-soft bg-sc-surface">
      <div className="flex-1 overflow-y-auto bg-[#fbfaf7] px-4 md:px-6">
        {messages.length === 0 ? (
          <Welcome firstName={firstName} config={config} onAsk={submit} />
        ) : (
          <div className="flex flex-col gap-4 py-5">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} role={role} onRetry={onRetry} onOpenDraft={onSupport} />
            ))}
            {pending && <TypingBubble />}
          </div>
        )}
        <div ref={bottom} />
      </div>

      <footer className="border-t border-sc-border-soft px-4 pt-3 pb-2 md:px-5">
        <div className="rounded-xl border-[1.5px] border-sc-ink px-3.5 pt-2.5 pb-2">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={ASSISTANT_MAX_TEXT}
            rows={2}
            placeholder={config.placeholder}
            aria-label="Câu hỏi cho trợ lý"
            className="block w-full resize-none border-0 bg-transparent text-[15px] text-sc-ink outline-none placeholder:text-sc-muted-2"
          />
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {config.chips.map(({ label, question, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  disabled={pending}
                  onClick={() => submit(question)}
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-sc-paper px-2 py-1 text-[13px] text-sc-ink-2 hover:bg-sc-paper-2 disabled:cursor-not-allowed"
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-[12.5px] text-sc-muted-2 tabular-nums sm:inline">
                {text.length} / {ASSISTANT_MAX_TEXT}
              </span>
              <button
                type="button"
                aria-label="Gửi"
                disabled={!text.trim() || pending}
                onClick={() => submit()}
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-sc-ink text-sc-lime disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </div>
        <p className="mt-2 mb-0 text-center text-[12.5px] text-sc-muted-2">
          Enter để gửi · Shift + Enter xuống dòng · {config.caution}
        </p>
      </footer>
    </section>
  );
}

interface ChatActionsProps {
  config: AssistantConfig;
  hasConversation: boolean;
  onNew: () => void;
  onDelete: () => void;
  onSupport: () => void;
}

/** New chat and the chat menu, shown on the page title row. */
export function ChatActions({ config, hasConversation, onNew, onDelete, onSupport }: ChatActionsProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button type="primary" icon={<SquarePen size={16} />} onClick={onNew} className="!bg-sc-ink">
        <span className="hidden sm:inline">Cuộc trò chuyện mới</span>
      </Button>
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            ...(config.support
              ? [
                  {
                    key: 'support',
                    icon: <LifeBuoy size={15} />,
                    label: 'Gửi yêu cầu hỗ trợ',
                    onClick: onSupport,
                  },
                ]
              : []),
            {
              key: 'delete',
              icon: <Trash2 size={15} />,
              label: 'Xóa cuộc trò chuyện này',
              danger: true,
              disabled: !hasConversation,
              onClick: onDelete,
            },
          ],
        }}
      >
        <Button icon={<Ellipsis size={16} />} aria-label="Tùy chọn" />
      </Dropdown>
    </div>
  );
}
