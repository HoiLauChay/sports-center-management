import { MoreHorizontal, Sparkles, SquarePen } from 'lucide-react';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { useAssistantContext } from '../hooks/useAssistantContext';
import { ChatComposer } from './ChatComposer';
import { ContextPanel } from './ContextPanel';
import { MessageList } from './MessageList';
import { WelcomeState } from './WelcomeState';

export function AssistantPage() {
  const { context, loading } = useAssistantContext();
  const { messages, recent, send, reset, pending } = useAssistantChat(context);
  const started = messages.length > 0;

  return (
    <>
      <div className="mb-5">
        <div className="flex items-center gap-2.5">
          <h1 className="m-0 font-display text-[28px] leading-tight font-extrabold uppercase md:text-[32px]">
            Trợ lý AI
          </h1>
          <span className="rounded-md bg-sc-lime px-2 py-[3px] font-display text-[11px] font-bold tracking-[0.08em]">
            BETA
          </span>
        </div>
        <p className="mt-1 mb-0 text-sc-muted">
          Hỏi về lịch tập, bài tập, gói thành viên hoặc dịch vụ của trung tâm — trợ lý trả lời dựa trên dữ liệu tài
          khoản của bạn.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-[20px] border border-sc-border-soft bg-white shadow-[0_8px_24px_-8px_rgba(20,19,15,0.08)] lg:h-[calc(100dvh-230px)]">
          <header className="flex items-center gap-3 border-b border-sc-border-soft px-4 py-3.5 md:px-[22px]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sc-ink text-sc-lime">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Trợ lý Sports Center</div>
              <div className="flex items-center gap-1.5 text-[12px] text-sc-muted">
                <span className="size-[7px] shrink-0 rounded-full bg-sc-success" />
                <span className="truncate">Đang hoạt động · đã kết nối dữ liệu tài khoản của bạn</span>
              </div>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={!started}
              className="flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] [border:none] bg-sc-ink pr-3.5 pl-3 text-[13px] font-semibold text-white [transition:opacity_0.15s] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SquarePen size={14} className="text-sc-lime" />
              <span className="hidden sm:inline">Cuộc trò chuyện mới</span>
            </button>
            <button
              type="button"
              aria-label="Tùy chọn khác"
              className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-sc-border-soft bg-white text-sc-muted hover:bg-sc-paper"
            >
              <MoreHorizontal size={16} />
            </button>
          </header>

          <div
            className={`flex-1 overflow-y-auto px-4 py-6 md:px-8 ${started ? 'bg-white' : 'flex flex-col bg-[linear-gradient(180deg,#faf9f5,#fff)]'}`}
          >
            {started ? (
              <MessageList messages={messages} pending={pending} />
            ) : (
              <WelcomeState firstName={context.firstName} onPick={send} />
            )}
          </div>

          <ChatComposer pending={pending} onSend={send} />
        </section>

        <ContextPanel context={context} loading={loading} recent={recent} onPick={send} />
      </div>
    </>
  );
}
