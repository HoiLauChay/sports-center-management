import { Tag } from 'antd';
import { formatVND } from '~/lib/format';
import type { Quote } from '../types';

export function QuoteTotals({ quote }: { quote: Quote }) {
  const appliedCoupons = quote.coupons.filter(({ applied }) => applied);

  return (
    <div className="flex flex-col text-[13.5px]">
      <div className="divide-y divide-sc-border-soft">
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-sc-ink-2">Tạm tính</span>
          <span className="whitespace-nowrap font-medium tabular-nums text-sc-ink">{formatVND(quote.subtotal)}</span>
        </div>

        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-sc-ink-2">Ưu đãi gói thành viên</span>
          <span
            className={`whitespace-nowrap tabular-nums ${
              quote.membershipDiscount > 0 ? 'font-medium text-sc-success' : 'text-sc-muted'
            }`}
          >
            {quote.membershipDiscount > 0 ? `−${formatVND(quote.membershipDiscount)}` : '0 đ'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-sc-ink-2">
            {appliedCoupons.length ? (
              <span className="inline-flex items-center gap-1.5">
                <span>Mã giảm giá</span>
                {appliedCoupons.map(({ code }) => (
                  <Tag key={code} className="!m-0 text-xs font-mono font-medium">
                    {code}
                  </Tag>
                ))}
              </span>
            ) : (
              'Mã giảm giá'
            )}
          </span>
          <span
            className={`whitespace-nowrap tabular-nums ${
              quote.couponDiscount > 0 ? 'font-medium text-sc-success' : 'text-sc-muted'
            }`}
          >
            {quote.couponDiscount > 0 ? `−${formatVND(quote.couponDiscount)}` : '0 đ'}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-sc-border pt-3">
        <span className="text-[14px] font-semibold text-sc-ink">Phải trả</span>
        <span className="whitespace-nowrap font-display text-[22px] font-extrabold tabular-nums text-sc-ink">
          {formatVND(quote.total)}
        </span>
      </div>

      {quote.total === 0 && quote.items.length > 0 && (
        <Tag color="success" className="!mt-2.5">
          Đơn miễn phí: vẫn ghi nhận hóa đơn, không trừ ví
        </Tag>
      )}
    </div>
  );
}
