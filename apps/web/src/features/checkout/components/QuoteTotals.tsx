import { Tag } from 'antd';
import type { ReactNode } from 'react';
import { formatVND } from '~/lib/format';
import type { Quote } from '../types';

function Row({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'discount' }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-dashed border-sc-border py-1.5 ${tone === 'discount' ? 'text-sc-success' : ''}`}
    >
      <span>{label}</span>
      <span className="whitespace-nowrap tabular-nums">{value}</span>
    </div>
  );
}

const couponLabel = (coupons: { code: string }[]) =>
  coupons.length ? `Mã giảm giá ${coupons.map(({ code }) => code).join(', ')}` : 'Mã giảm giá';

export function QuoteTotals({ quote }: { quote: Quote }) {
  return (
    <div className="text-[14px]">
      <Row label="Tạm tính" value={formatVND(quote.subtotal)} />
      <Row label="Ưu đãi gói thành viên" value={`−${formatVND(quote.membershipDiscount)}`} tone="discount" />
      <Row
        label={couponLabel(quote.coupons.filter(({ applied }) => applied))}
        value={`−${formatVND(quote.couponDiscount)}`}
        tone="discount"
      />
      <div className="flex items-center justify-between gap-4 border-b-2 border-sc-ink py-2.5 font-display text-[22px] font-extrabold">
        <span>Phải trả</span>
        <span className="whitespace-nowrap tabular-nums">{formatVND(quote.total)}</span>
      </div>
      {quote.total === 0 && quote.items.length > 0 && (
        <Tag color="success" className="!mt-2">
          Đơn miễn phí: vẫn ghi nhận hóa đơn, không trừ ví
        </Tag>
      )}
    </div>
  );
}
