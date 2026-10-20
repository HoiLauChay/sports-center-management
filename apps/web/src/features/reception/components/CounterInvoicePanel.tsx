import type { Invoice } from '@sports-center/shared';
import { Button, Image } from 'antd';
import type { ReactNode } from 'react';
import { CopyButton } from '~/components/ui/CopyButton';
import { InvoicePayPanel, formatCountdown, useCountdown } from '~/features/wallet';
import { formatVND } from '~/lib/format';

const QR_FALLBACK =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='100%' height='100%' fill='%23f2efe8'/><text x='50%' y='50%' text-anchor='middle' fill='%237a776f' font-size='13' font-family='sans-serif'>Không tải được mã QR</text></svg>";

function InfoRow({ label, value, copy }: { label: string; value: ReactNode; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sc-border-soft py-2.5 last:border-b-0">
      <span className="shrink-0 text-[14.5px] text-sc-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-right font-semibold [overflow-wrap:anywhere]">
        {value}
        {copy && <CopyButton value={copy} label={label} />}
      </span>
    </div>
  );
}

interface CounterInvoicePanelProps {
  invoice: Invoice;
  paidMessage?: ReactNode;
  onCancel?: () => void;
  cancelling?: boolean;
}

export function CounterInvoicePanel({ invoice, paidMessage, onCancel, cancelling }: CounterInvoicePanelProps) {
  const remaining = useCountdown(invoice.status === 'PENDING' ? invoice.expiresAt : undefined);
  if (invoice.status !== 'PENDING' || remaining === 0) {
    return <InvoicePayPanel invoice={invoice} paidMessage={paidMessage} onCancel={onCancel} cancelling={cancelling} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <span className="inline-flex items-center gap-2 rounded-full bg-sc-warning/10 px-3 py-1 text-[14.5px] font-semibold text-sc-warning">
        <span className="size-2 animate-pulse rounded-full bg-sc-warning" />
        Đang chờ khách chuyển khoản · còn <b className="tabular-nums">{formatCountdown(remaining ?? 0)}</b>
      </span>
      <div className="rounded-2xl border border-sc-border bg-white p-3 shadow-sm">
        <Image
          src={invoice.qrImageUrl}
          alt={`Mã QR chuyển khoản ${invoice.paymentCode}`}
          width={300}
          height={300}
          preview={false}
          fallback={QR_FALLBACK}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[14.5px] text-sc-muted">Số tiền</span>
        <span className="flex items-center gap-1 font-display text-[40px] leading-none font-extrabold tabular-nums text-sc-ink">
          {formatVND(invoice.amount)}
          <CopyButton value={String(invoice.amount)} label="Số tiền" />
        </span>
      </div>
      <div className="w-full max-w-md rounded-lg bg-sc-paper px-4 py-1 text-left">
        <InfoRow label="Nội dung chuyển khoản" value={invoice.transferContent} copy={invoice.transferContent} />
        <InfoRow
          label="Tài khoản nhận"
          value={
            [invoice.bankAccount.bankCode, invoice.bankAccount.accountNumber, invoice.bankAccount.accountName]
              .filter(Boolean)
              .join(' · ') || '—'
          }
        />
      </div>
      <p className="m-0 max-w-md text-[13.5px] text-sc-muted">
        Khách quét mã bằng app ngân hàng, giữ nguyên số tiền và nội dung. Màn hình tự chuyển khi tiền về.
      </p>
      {onCancel && (
        <Button size="large" loading={cancelling} onClick={onCancel}>
          Đổi cách thanh toán
        </Button>
      )}
    </div>
  );
}
