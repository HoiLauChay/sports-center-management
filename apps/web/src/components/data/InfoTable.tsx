import type { ReactNode } from 'react';

export interface InfoTableRow {
  label: string;
  value: ReactNode;
}

/** Bordered label / value rows (grey label column), as the detail panels in the design. */
export function InfoTable({ rows }: { rows: InfoTableRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-solid border-sc-border">
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={`flex items-stretch ${index < rows.length - 1 ? 'border-0 border-b border-solid border-sc-border' : ''}`}
        >
          <div className="flex w-[150px] shrink-0 items-center bg-[#f7f5f0] px-3.5 py-2.5 text-[13px] font-medium text-sc-muted">
            {row.label}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 px-3.5 py-2 text-[13px] text-sc-ink">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
