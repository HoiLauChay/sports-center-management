import type { SupportCategory, SupportPriority } from '@sports-center/shared';
import { Alert, Button, Tag } from 'antd';
import { Sparkles } from 'lucide-react';
import { describeApiError } from '~/lib/http-errors';
import { useSupportTriage } from '../hooks/useManagerAi';
import { AiPanel } from './AiPanel';

const PRIORITY: Record<SupportPriority, { color: string; label: string }> = {
  HIGH: { color: 'red', label: 'Ưu tiên cao' },
  MEDIUM: { color: 'gold', label: 'Ưu tiên vừa' },
  LOW: { color: 'default', label: 'Ưu tiên thấp' },
};

interface SupportTriagePanelProps {
  requestId: string;
  categoryLabel: Record<SupportCategory, string>;
  disabled?: boolean;
  /** Puts the drafted reply into the reply box; staff still edit and save it themselves. */
  onUseReply: (reply: string) => void;
}

/** Category, priority, a one-line summary and a drafted reply for a support request, on demand. */
export function SupportTriagePanel({ requestId, categoryLabel, disabled, onUseReply }: SupportTriagePanelProps) {
  const triage = useSupportTriage();
  const run = () => triage.mutate(requestId);

  if (triage.isIdle) {
    return (
      <Button icon={<Sparkles size={15} />} className="self-start" disabled={disabled} onClick={run}>
        Phân loại và soạn phản hồi bằng AI
      </Button>
    );
  }
  const data = triage.data;
  return (
    <AiPanel title="Gợi ý xử lý" ai={data?.ai} loading={triage.isPending} onRefresh={run}>
      {triage.isError ? (
        <Alert type="warning" showIcon message={describeApiError(triage.error)} />
      ) : (
        data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={PRIORITY[data.priority].color} className="!m-0">
                {PRIORITY[data.priority].label}
              </Tag>
              <Tag className="!m-0">{categoryLabel[data.category]}</Tag>
              <span className="text-[14px] text-sc-ink">{data.summary}</span>
            </div>
            <p className="m-0 rounded-lg bg-white/70 px-3 py-2 text-[14px] whitespace-pre-line text-sc-ink-2">
              {data.reply}
            </p>
            <Button
              size="small"
              type="primary"
              className="self-start"
              disabled={disabled}
              onClick={() => onUseReply(data.reply)}
            >
              Dùng nháp này
            </Button>
          </>
        )
      )}
    </AiPanel>
  );
}
