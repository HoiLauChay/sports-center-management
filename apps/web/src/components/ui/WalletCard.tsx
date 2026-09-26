import type { ReactNode } from 'react';
import { formatVND } from '~/lib/format';
import './wallet-card.css';

interface WalletCardProps {
  balance: number;
  label?: string;
  description?: ReactNode;
}

export function WalletCard({ balance, label = 'Số dư ví', description }: WalletCardProps) {
  return (
    <div className="sc-wallet-card">
      <small>{label}</small>
      <div className="amount">{formatVND(balance)}</div>
      {description && <p>{description}</p>}
    </div>
  );
}
