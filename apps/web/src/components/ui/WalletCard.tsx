import type { ReactNode } from 'react';
import { formatVND } from '~/lib/format';

interface WalletCardProps {
  balance: number;
  label?: string;
  description?: ReactNode;
}

export function WalletCard({ balance, label = 'Số dư ví', description }: WalletCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-sc-ink p-5 text-white after:absolute after:-top-10 after:-right-10 after:size-[140px] after:rounded-[50%] after:bg-[radial-gradient(circle,rgba(214,242,75,0.35),transparent_70%)] after:content-['']">
      <small className="font-display text-[12px] font-bold tracking-[0.12em] text-[rgba(255,255,255,0.55)] uppercase">
        {label}
      </small>
      <div className="mt-1.5 font-display text-[34px] leading-none font-extrabold text-sc-lime tabular-nums">
        {formatVND(balance)}
      </div>
      {description && <p className="mx-0 mt-2.5 mb-0 text-[12px] text-[rgba(255,255,255,0.5)]">{description}</p>}
    </div>
  );
}
