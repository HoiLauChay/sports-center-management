import type { AssistantRole, SupportDraft } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { House } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '~/features/auth';
import { SupportRequestModal } from '~/features/support';
import { ASSISTANT_CONFIG } from '../config';
import { useAssistantChat, useAssistantOverview } from '../hooks/useAssistant';
import type { ChatMessage } from '../store/conversations';
import { ChatActions, ChatPanel } from './ChatPanel';
import { OverviewCard, RecentCard } from './SidePanels';

/**
 * The AI assistant page (Flow 6): `/assistant` for members, `/coach/assistant`, `/reception/assistant`.
 * The server picks the tools for the signed-in role; this page only changes the words and the side panel.
 */
export function AssistantPage() {
  const user = useCurrentUser();
  const overview = useAssistantOverview();
  const chat = useAssistantChat();
  const [support, setSupport] = useState<{ open: boolean; draft: SupportDraft | null }>({ open: false, draft: null });
  const role = user.role as AssistantRole;
  const config = ASSISTANT_CONFIG[role];
  const firstName = user.fullName.trim().split(/\s+/).at(-1) ?? user.fullName;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[13.5px] text-sc-muted">
        <Link to="/dashboard" aria-label="Tổng quan" className="flex !text-sc-muted hover:!text-sc-ink">
          <House size={15} />
        </Link>
        <span>/</span>
        <Link to={config.breadcrumb.to} className="!text-sc-muted hover:!text-sc-ink">
          {config.breadcrumb.label}
        </Link>
        <span>/</span>
        <span className="text-sc-ink">Trợ lý AI</span>
      </nav>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3" title={config.description}>
          <h1 className="m-0 font-display text-[27px] leading-[1.05] font-extrabold uppercase md:text-[38px]">
            Trợ lý AI
          </h1>
          <span className="rounded-md bg-sc-lime px-2 py-0.5 text-[12px] font-bold tracking-[0.08em]">BETA</span>
        </div>
        <ChatActions
          config={config}
          hasConversation={Boolean(chat.active)}
          onNew={chat.startNew}
          onDelete={() => chat.active && chat.remove(chat.active.id)}
          onSupport={() => setSupport({ open: true, draft: null })}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ChatPanel
          firstName={firstName}
          role={role}
          config={config}
          conversation={chat.active}
          pending={chat.pending}
          onSend={chat.send}
          onRetry={chat.retry}
          onSupport={(message?: ChatMessage) => setSupport({ open: true, draft: message?.supportDraft ?? null })}
        />
        <aside className="flex flex-col gap-5 lg:grid lg:h-[max(560px,calc(100dvh-160px))] lg:grid-rows-2">
          <RecentCard conversations={chat.conversations} activeId={chat.active?.id ?? null} onOpen={chat.open} />
          <OverviewCard overview={overview.data} loading={overview.isPending} />
        </aside>
      </div>

      <SupportRequestModal
        open={support.open}
        draft={support.draft}
        onClose={() => setSupport({ open: false, draft: null })}
      />
    </div>
  );
}
