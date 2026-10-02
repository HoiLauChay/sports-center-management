import type { Invoice } from '@sports-center/shared';
import { Alert, Button, Image, Tag } from 'antd';
import { CheckCircle2, Clock3, TimerOff, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { CopyButton } from '~/components/ui/CopyButton';
import { formatVND } from '~/lib/format';
import { formatCountdown, useCountdown } from '../hooks/useWallet';

function InfoRow({ label, value, copy }: { label: string; value: ReactNode; copy?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-sc-border-soft py-2.5 last:border-b-0">
      <span className="shrink-0 text-[13px] text-sc-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1 text-right font-semibold [overflow-wrap:anywhere]">
        {value}
        {copy && <CopyButton value={copy} label={label} />}
      </span>
    </div>
  );
}

function Outcome({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {icon}
      <h3 className="m-0 font-display text-[22px] font-extrabold uppercase">{title}</h3>
      {children && <div className="max-w-md text-sc-muted">{children}</div>}
    </div>
  );
}

interface InvoicePayPanelProps {
  invoice: Invoice;
  /** Shown to the payer once the invoice is paid (e.g. "Về ví", "In biên lai"). */
  paidActions?: ReactNode;
  /** When set, a "Hủy hóa đơn" button is offered while the invoice is pending (counter staff). */
  onCancel?: () => void;
  cancelling?: boolean;
  /** Text under the "paid" title; defaults to the wallet top-up wording. */
  paidMessage?: ReactNode;
}

/** QR + transfer details of a pending invoice, or its final outcome. Status polling is done by the caller. */
export function InvoicePayPanel({ invoice, paidActions, onCancel, cancelling, paidMessage }: InvoicePayPanelProps) {
  const remaining = useCountdown(invoice.status === 'PENDING' ? invoice.expiresAt : undefined);
  const expired = invoice.status === 'EXPIRED' || (invoice.status === 'PENDING' && remaining === 0);

  if (invoice.status === 'PAID') {
    return (
      <Outcome icon={<CheckCircle2 size={44} className="text-sc-success" />} title="Thanh toán thành công">
        {paidMessage ?? <>Đã nhận {formatVND(invoice.amount)}. Số dư ví đã được cập nhật.</>}
        {paidActions && <div className="mt-4 flex flex-wrap justify-center gap-2">{paidActions}</div>}
      </Outcome>
    );
  }
  if (invoice.status === 'CANCELLED') {
    return (
      <Outcome icon={<XCircle size={44} className="text-sc-muted-2" />} title="Hóa đơn đã hủy">
        Hóa đơn này không còn hiệu lực, vui lòng không chuyển khoản theo mã cũ.
      </Outcome>
    );
  }
  if (invoice.status === 'FAILED') {
    return (
      <Outcome icon={<XCircle size={44} className="text-sc-error" />} title="Hóa đơn thất bại">
        Hệ thống nhận được tiền nhưng không hoàn tất được đơn (ví dụ slot vừa được người khác đặt). Thông tin giao dịch
        đã được chuyển cho quản lý đối soát; vui lòng không thu lại tiền của khách.
      </Outcome>
    );
  }
  if (expired) {
    return (
      <Outcome icon={<TimerOff size={44} className="text-sc-warning" />} title="Hóa đơn đã hết hạn">
        Mã QR đã được ẩn. Nếu bạn đã chuyển khoản, tiền vẫn được ghi nhận khi đúng nội dung và số tiền; nếu chưa, hãy
        tạo hóa đơn mới.
      </Outcome>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-xl border border-sc-border bg-white p-2">
          <Image
            src={invoice.qrImageUrl}
            alt={`Mã QR chuyển khoản ${invoice.paymentCode}`}
            width={240}
            height={240}
            preview={false}
            fallback="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='100%' height='100%' fill='%23f2efe8'/><text x='50%' y='50%' text-anchor='middle' fill='%237a776f' font-size='13' font-family='sans-serif'>Không tải được mã QR</text></svg>"
          />
        </div>
        <Tag color="warning" className="!m-0 !inline-flex items-center gap-1.5 !px-3 !py-1 !text-[14px]">
          <Clock3 size={14} />
          Còn <b className="tabular-nums">{formatCountdown(remaining ?? 0)}</b>
        </Tag>
        <p className="m-0 text-center text-xs text-sc-muted-2">
          Hệ thống tự kiểm tra mỗi 3 giây, không cần tải lại trang.
        </p>
      </div>
      <div>
        <InfoRow label="Ngân hàng" value={invoice.bankAccount.bankCode || '—'} />
        <InfoRow
          label="Số tài khoản"
          value={invoice.bankAccount.accountNumber || '—'}
          copy={invoice.bankAccount.accountNumber}
        />
        <InfoRow label="Chủ tài khoản" value={invoice.bankAccount.accountName || '—'} />
        <InfoRow label="Số tiền" value={formatVND(invoice.amount)} copy={String(invoice.amount)} />
        <InfoRow label="Nội dung chuyển khoản" value={invoice.transferContent} copy={invoice.transferContent} />
        <Alert
          type="info"
          showIcon
          className="!mt-4"
          title="Nhập đúng nội dung và số tiền để hệ thống tự cộng. Chuyển sai nội dung hoặc sai số tiền sẽ phải chờ quản lý đối soát."
        />
        {onCancel && (
          <Button danger className="!mt-4" loading={cancelling} onClick={onCancel}>
            Hủy hóa đơn
          </Button>
        )}
      </div>
    </div>
  );
}
