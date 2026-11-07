import { Button, Skeleton, Tooltip } from 'antd';
import { RefreshCw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

/** Whether the text came from AI or, because AI was unavailable, from the plain template. */
export function AiSourceTag({ ai }: { ai: boolean }) {
  return (
    <Tooltip title={ai ? 'Do AI viết từ số liệu, có thể nhầm' : 'AI đang không dùng được, đây là bản tóm tắt theo mẫu'}>
      <span
        className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-bold tracking-[0.06em] ${ai ? 'bg-sc-lime text-sc-ink' : 'bg-sc-paper-2 text-sc-muted'}`}
      >
        {ai ? 'AI' : 'MẪU'}
      </span>
    </Tooltip>
  );
}

interface AiPanelProps {
  title: string;
  /** Unset until the first result arrives. */
  ai?: boolean;
  loading?: boolean;
  onRefresh?: () => void;
  extra?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** The frame every AI helper in the manager pages uses, so they read as one feature. */
export function AiPanel({ title, ai, loading, onRefresh, extra, children, className = '' }: AiPanelProps) {
  return (
    <section
      className={`flex flex-col gap-2.5 rounded-xl border border-sc-primary-border bg-sc-primary-soft px-4 py-3 ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Sparkles size={16} className="text-sc-primary" />
          <span className="text-[13px] font-bold tracking-[0.06em] text-sc-primary uppercase">{title}</span>
          {ai !== undefined && !loading && <AiSourceTag ai={ai} />}
        </span>
        <span className="flex items-center gap-2">
          {extra}
          {onRefresh && ai !== undefined && (
            <Button size="small" type="text" icon={<RefreshCw size={14} />} loading={loading} onClick={onRefresh}>
              Viết lại
            </Button>
          )}
        </span>
      </div>
      {loading ? <Skeleton active title={false} paragraph={{ rows: 2 }} /> : children}
    </section>
  );
}
