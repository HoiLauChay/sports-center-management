import { Card } from 'antd';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** `warning` highlights numbers that need attention (e.g. unmatched bank transactions). */
  tone?: 'default' | 'warning';
  loading?: boolean;
  hint?: ReactNode;
}

export function StatCard({ label, value, icon: Icon, tone = 'default', loading, hint }: StatCardProps) {
  const warning = tone === 'warning';
  return (
    <Card loading={loading} styles={{ body: { padding: '14px 18px' } }} className="h-full">
      <div className="flex h-full flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${warning ? 'bg-sc-accent-soft text-sc-accent' : 'bg-sc-primary-soft text-sc-primary'}`}
            >
              <Icon size={16} />
            </span>
          )}
          <span className="min-w-0 text-[14px] leading-tight font-semibold tracking-wide text-sc-muted uppercase">
            {label}
          </span>
        </div>
        <div
          className={`font-display text-[clamp(24px,2vw,32px)] leading-none font-extrabold whitespace-nowrap tabular-nums ${warning ? 'text-sc-accent' : 'text-sc-ink'}`}
        >
          {value}
        </div>
        {hint && <div className="-mt-1 text-[14px] text-sc-muted">{hint}</div>}
      </div>
    </Card>
  );
}
