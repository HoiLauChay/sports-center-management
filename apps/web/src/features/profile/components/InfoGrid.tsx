import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface InfoItem {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  /** Spans both columns (long text such as bio or address). */
  full?: boolean;
}

export function InfoGrid({ items, single = false }: { items: InfoItem[]; single?: boolean }) {
  return (
    <div className={`sc-info-grid${single ? ' single' : ''}`}>
      {items.map(({ label, value, icon: Icon, full }) => {
        const empty = value === null || value === undefined || value === '';
        return (
          <div key={label} className={`sc-info-item${full ? ' full' : ''}`}>
            {Icon && (
              <span className="ico">
                <Icon size={16} />
              </span>
            )}
            <div className="body">
              <div className="label">{label}</div>
              <div className={`value${empty ? ' empty' : ''}`}>{empty ? 'Chưa cập nhật' : value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
