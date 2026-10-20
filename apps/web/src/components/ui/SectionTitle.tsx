import type { ReactNode } from 'react';

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mx-0 mt-0 mb-4 font-display text-[18px] font-bold tracking-[0.06em] text-sc-ink uppercase">
      {children}
    </h3>
  );
}
