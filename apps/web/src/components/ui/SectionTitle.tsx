import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mx-0 mt-0 mb-[14px] font-display text-[15px] font-bold tracking-[0.08em] text-sc-ink uppercase">
      {children}
    </h3>
  );
}
