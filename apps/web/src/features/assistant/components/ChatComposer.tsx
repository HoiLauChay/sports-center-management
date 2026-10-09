import { ArrowUp, CalendarDays, Clock, Ticket } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

const MAX_LENGTH = 1000;

const SHORTCUTS = [
  { icon: CalendarDays, label: 'Lịch tập', question: 'Buổi tập kế tiếp của tôi là khi nào?' },
  { icon: Ticket, label: 'Gói của tôi', question: 'Gói của tôi còn bao lâu?' },
  { icon: Clock, label: 'Giờ mở cửa', question: 'Trung tâm mở cửa mấy giờ?' },
];

interface ChatComposerProps {
  pending: boolean;
  onSend: (text: string) => void;
}

export function ChatComposer({ pending, onSend }: ChatComposerProps) {
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0 && !pending;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-sc-border-soft px-4 pt-3.5 pb-3 md:px-6">
      <div className="rounded-2xl border-[1.5px] border-sc-ink bg-white pt-3.5 pr-2.5 pb-2.5 pl-4 [transition:box-shadow_0.15s] focus-within:shadow-[0_0_0_4px_rgba(214,242,75,0.45)]">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_LENGTH}
          rows={1}
          aria-label="Câu hỏi cho trợ lý"
          placeholder={
            pending
              ? 'Trợ lý đang trả lời… bạn vẫn có thể gõ câu tiếp theo'
              : 'Hỏi về lịch tập, gói, lớp hoặc bài tập của bạn…'
          }
          className="block max-h-40 min-h-[22px] w-full resize-none [border:none] bg-transparent p-0 text-[14.5px] leading-[22px] text-sc-ink outline-none [field-sizing:content] placeholder:text-sc-muted-2"
        />
        <div className="mt-3 flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {SHORTCUTS.map(({ icon: Icon, label, question }) => (
              <button
                key={label}
                type="button"
                disabled={pending}
                onClick={() => onSend(question)}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg [border:none] bg-sc-paper px-2.5 py-1.5 text-[12px] font-medium text-sc-ink-2 [transition:background_0.15s] hover:bg-sc-paper-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Icon size={12} className="text-sc-muted" />
                {label}
              </button>
            ))}
          </div>
          <span className="hidden text-[11.5px] text-sc-muted-2 sm:inline">
            {text.length} / {MAX_LENGTH}
          </span>
          <button
            type="button"
            aria-label="Gửi"
            disabled={!canSend}
            onClick={submit}
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] [border:none] bg-sc-ink text-sc-lime [transition:opacity_0.15s] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ArrowUp size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <p className="mt-2 mb-0 text-center text-[11.5px] text-sc-muted-2">
        Enter để gửi · Shift + Enter xuống dòng · Trợ lý có thể nhầm — luôn kiểm tra lại trước khi thanh toán hoặc đặt
        chỗ.
      </p>
    </div>
  );
}
