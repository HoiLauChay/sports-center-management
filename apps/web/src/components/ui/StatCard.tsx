import { Card } from 'antd';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  /** `warning` highlights numbers that need attention (e.g. unmatched bank transactions). */
  tone?: 'default' | 'warning';
  loading?: boolean;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', loading }: StatCardProps) {
  return (
    <Card loading={loading} styles={{ body: { padding: 18 } }} className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold tracking-wide text-sc-muted uppercase">{label}</div>
          <div
            className={`mt-1 font-display text-[clamp(22px,2.4vw,30px)] leading-none font-extrabold whitespace-nowrap tabular-nums ${tone === 'warning' ? 'text-sc-accent' : 'text-sc-ink'}`}
          >
            {value}
          </div>
          {hint && <div className="mt-1.5 text-[12.5px] text-sc-muted">{hint}</div>}
        </div>
        {Icon && (
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone === 'warning' ? 'bg-sc-accent-soft text-sc-accent' : 'bg-sc-primary-soft text-sc-primary'}`}
          >
            <Icon size={18} />
          </span>
        )}
      </div>
    </Card>
  );
}
