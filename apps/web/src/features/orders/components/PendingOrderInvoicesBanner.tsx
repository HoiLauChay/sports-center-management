import type { Invoice } from '@sports-center/shared';
import { Link } from '@tanstack/react-router';
import { Button, Tag } from 'antd';
import { Clock, QrCode } from 'lucide-react';
import { invoiceStatusOf } from '~/constants/payment';
import { formatCountdown, useCountdown } from '~/features/wallet';
import { formatDateTime, formatVND } from '~/lib/format';
import { usePendingOrderInvoices } from '../hooks/useOrders';

function PendingOrderInvoiceRow({ invoice }: { invoice: Invoice }) {
  const remainingSeconds = useCountdown(invoice.expiresAt);
  if (remainingSeconds !== null && remainingSeconds <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200/90 bg-white px-4 py-3 shadow-xs">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[15px] font-bold text-sc-ink">{invoice.paymentCode}</span>
          <span className="text-[16px] font-extrabold text-amber-700 tabular-nums">{formatVND(invoice.amount)}</span>
          {remainingSeconds !== null && (
            <Tag color="warning" className="!m-0 inline-flex items-center gap-1 font-medium tabular-nums">
              <Clock size={12} />
              Còn {formatCountdown(remainingSeconds)}
            </Tag>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13.5px] text-sc-muted">
          <span>
            Nội dung CK: <code className="font-mono font-semibold text-sc-ink">{invoice.transferContent}</code>
          </span>
          <span>· Lập lúc {formatDateTime(invoice.createdAt)}</span>
        </div>
      </div>

      <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
        <Button type="primary" icon={<QrCode size={15} />}>
          Tiếp tục thanh toán QR
        </Button>
      </Link>
    </div>
  );
}

/** Alerts a member about unexpired QR order-payment invoices so they can resume scanning and complete payment. */
export function PendingOrderInvoicesBanner() {
  const pending = usePendingOrderInvoices();
  const activeInvoices = (pending.data?.items ?? []).filter((invoice) => invoiceStatusOf(invoice) === 'PENDING');

  if (activeInvoices.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-amber-900">
          <QrCode size={18} className="shrink-0 text-amber-700" />
          <span className="text-[15.5px] font-bold">
            Phiếu thanh toán chuyển khoản đang chờ ({activeInvoices.length})
          </span>
        </div>
        <span className="text-[13.5px] text-amber-800/90">
          Đơn hàng sẽ tự động ghi nhận ngay sau khi chuyển khoản đúng nội dung
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {activeInvoices.map((invoice) => (
          <PendingOrderInvoiceRow key={invoice.id} invoice={invoice} />
        ))}
      </div>
    </div>
  );
}
