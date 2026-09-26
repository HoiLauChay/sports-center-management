import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface InfoItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  full?: boolean;
}

export function InfoGrid({ items, single = false }: { items: InfoItem[]; single?: boolean }) {
  return (
    <div className={`grid gap-x-6 gap-y-0 ${single ? 'grid-cols-1' : 'grid-cols-2 max-md:grid-cols-1'}`}>
      {items.map(({ label, value, icon: Icon, full }) => {
        const empty = value === null || value === undefined || value === '';
        return (
          <div
            key={label}
            className={`flex gap-3 border-b border-b-sc-border-soft py-3.5 ${full ? 'col-span-full' : ''}`}
          >
            {Icon && (
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-sc-paper text-sc-ink-2">
                <Icon size={16} />
              </span>
            )}
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-sc-muted">{label}</div>
              <div
                className={`mt-0.5 text-[14.5px] wrap-anywhere whitespace-pre-line ${empty ? 'font-normal text-sc-muted-2' : 'font-medium text-sc-ink'}`}
              >
                {empty ? 'Chưa cập nhật' : value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
