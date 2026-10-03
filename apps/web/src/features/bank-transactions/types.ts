import type { BankTransactionStatus, InvoicePurpose } from '@sports-center/shared';

export const BANK_TX_STATUS_TAG: Record<BankTransactionStatus, { label: string; color?: string }> = {
  UNMATCHED: { label: 'Chưa khớp', color: 'warning' },
  MATCHED: { label: 'Đã khớp tự động', color: 'success' },
  RESOLVED: { label: 'Đã gán thủ công', color: 'processing' },
  IGNORED: { label: 'Đã bỏ qua' },
};

export const INVOICE_PURPOSE_LABEL: Record<InvoicePurpose, string> = {
  WALLET_TOP_UP: 'Nạp ví',
  COUNTER_ORDER: 'Đơn tại quầy',
};
