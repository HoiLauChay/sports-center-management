import type { BankTransaction, BankTransactionIssue } from '@sports-center/shared';
import { Tag } from 'antd';
import { formatDateTime, formatVND } from '~/lib/format';
import { INVOICE_PURPOSE_LABEL } from '../types';

const ISSUE_TAG: Record<BankTransactionIssue, { label: string; color: string }> = {
  ALREADY_PAID: { label: 'Chuyển trùng', color: 'error' },
  AMOUNT_MISMATCH: { label: 'Sai số tiền', color: 'warning' },
  INVOICE_CLOSED: { label: 'Hóa đơn đã đóng', color: 'warning' },
  UNKNOWN_CODE: { label: 'Mã lạ', color: 'default' },
  NO_CODE: { label: 'Không có mã', color: 'default' },
};

/** One line on why the transfer did not settle on its own. */
function issueDetail(transaction: BankTransaction): string | null {
  const invoice = transaction.codeInvoice;
  switch (transaction.issue) {
    case 'ALREADY_PAID':
      return invoice?.paidBy
        ? `Hóa đơn đã được trả lúc ${formatDateTime(invoice.paidBy.transactionDate)}${
            invoice.paidBy.referenceCode ? ` (${invoice.paidBy.referenceCode})` : ''
          }. Khách chuyển lần nữa.`
        : 'Hóa đơn đã được thanh toán trước đó.';
    case 'AMOUNT_MISMATCH': {
      if (!invoice) return null;
      const diff = transaction.amount - invoice.amount;
      return `Hóa đơn ${formatVND(invoice.amount)}, khách chuyển ${diff > 0 ? 'dư' : 'thiếu'} ${formatVND(Math.abs(diff))}.`;
    }
    case 'INVOICE_CLOSED':
      return `Tiền về khi hóa đơn đã ${invoice?.status === 'CANCELLED' ? 'bị hủy' : 'hết hạn'}.`;
    case 'UNKNOWN_CODE':
      return 'Mã thanh toán không thuộc hóa đơn nào.';
    case 'NO_CODE':
      return 'Nội dung không có mã thanh toán, cần tra theo người chuyển.';
    default:
      return null;
  }
}

/** Who the payment code says the money is from, and for what. */
export function TransferPayer({ transaction }: { transaction: BankTransaction }) {
  const invoice = transaction.codeInvoice;
  if (!invoice) return <span className="text-sc-muted-2">Không rõ</span>;
  const name = invoice.account?.fullName ?? invoice.guestName ?? 'Khách vãng lai';
  const phone = invoice.account?.phone ?? invoice.guestPhone;
  return (
    <div className="flex min-w-36 flex-col gap-0.5 text-[14.5px]">
      <span className="font-medium">{name}</span>
      {phone && <span className="text-sc-muted tabular-nums">{phone}</span>}
      <span className="text-sc-muted-2">
        {INVOICE_PURPOSE_LABEL[invoice.purpose]}
        {!invoice.account && ' · khách vãng lai'}
      </span>
    </div>
  );
}

/** Status column: the status tag, plus the reason while the transfer is unmatched. */
export function TransferIssue({ transaction }: { transaction: BankTransaction }) {
  if (!transaction.issue) return null;
  const tag = ISSUE_TAG[transaction.issue];
  return (
    <div className="flex max-w-56 flex-col items-start gap-1">
      <Tag color={tag.color} className="!m-0">
        {tag.label}
      </Tag>
      <span className="text-[13.5px] text-sc-muted">{issueDetail(transaction)}</span>
    </div>
  );
}
