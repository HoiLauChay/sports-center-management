import { Alert, Button, Skeleton } from 'antd';
import { CalendarRange, Crown, Dumbbell, LandPlot, ShoppingBag, Ticket, Trash2, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CouponInput } from '~/features/checkout/components/CouponInput';
import type { CartLine, OrderItemType, Quote, QuoteLine } from '~/features/checkout/types';
import { ORDER_ITEM_TYPE_LABEL } from '~/features/checkout/types';
import { describeLine } from '~/features/checkout/utils';
import { formatVND } from '~/lib/format';

const TYPE_ICON: Record<OrderItemType, LucideIcon> = {
  FACILITY_BOOKING: LandPlot,
  FACILITY_PACKAGE: CalendarRange,
  COURSE_ENROLLMENT: Dumbbell,
  MEMBERSHIP: Crown,
};

const BENEFIT_LABEL: Record<string, string> = {
  GYM_ACCESS: 'Gym miễn phí theo gói',
  FREE_SLOT: 'Slot miễn phí theo gói',
  DISCOUNT: 'Giảm giá theo gói',
};

function LineCard({
  line,
  item,
  fresh,
  disabled,
  onRemove,
}: {
  line: CartLine;
  item: QuoteLine | undefined;
  fresh: boolean;
  disabled?: boolean;
  onRemove: () => void;
}) {
  const Icon = TYPE_ICON[line.selection.type];
  const description = item ? describeLine(item.type, item.snapshot ?? {}) : null;
  const benefit = typeof item?.snapshot?.benefit === 'string' ? BENEFIT_LABEL[item.snapshot.benefit] : undefined;
  const discounted = item && item.total < item.subtotal;

  return (
    <li
      className={`flex gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-700 ${
        item && !item.valid
          ? 'border-sc-error/40 bg-sc-error/5'
          : fresh
            ? 'border-sc-primary-border bg-sc-primary-soft'
            : 'border-sc-border-soft bg-white'
      }`}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-sc-paper text-sc-ink-2">
        <Icon size={16} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] font-semibold tracking-[0.04em] text-sc-muted uppercase">
          {ORDER_ITEM_TYPE_LABEL[line.selection.type]}
        </span>
        {description ? (
          <>
            <b className="text-[14px] leading-snug text-sc-ink [overflow-wrap:anywhere]">{description.title}</b>
            {description.detail && <span className="text-[12.5px] text-sc-muted">{description.detail}</span>}
          </>
        ) : (
          <Skeleton active title={false} paragraph={{ rows: 1, width: '70%' }} className="!mt-1" />
        )}
        {benefit && <span className="text-xs font-semibold text-sc-success">{benefit}</span>}
        {item && !item.valid && (
          <span className="text-[12.5px] text-sc-error">{item.error?.message ?? 'Dịch vụ không hợp lệ'}</span>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-1">
        {item ? (
          <span className="flex flex-col items-end leading-tight">
            <b className="tabular-nums text-sc-ink">{formatVND(item.total)}</b>
            {discounted && (
              <span className="text-xs text-sc-muted-2 tabular-nums line-through">{formatVND(item.subtotal)}</span>
            )}
          </span>
        ) : (
          <span className="text-sc-muted">…</span>
        )}
        <Button
          type="text"
          size="small"
          danger
          disabled={disabled}
          aria-label="Xóa dịch vụ này"
          icon={<Trash2 size={15} />}
          onClick={onRemove}
        />
      </div>
    </li>
  );
}

function TotalRow({ label, value, tone }: { label: ReactNode; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-[13.5px]">
      <span className="text-sc-ink-2">{label}</span>
      <span className={`tabular-nums ${tone === 'success' ? 'font-medium text-sc-success' : 'text-sc-ink'}`}>
        {value}
      </span>
    </div>
  );
}

interface CounterCartPanelProps {
  lines: CartLine[];
  quote: Quote | undefined;
  quoteError?: string;
  pricing: boolean;
  disabled?: boolean;
  onRemove: (lineKey: string) => void;
  /** Coupons are for members only; `undefined` hides the box. */
  coupons?: {
    codes: string[];
    check: (codes: string[]) => Promise<Quote>;
    onAdd: (code: string) => void;
    onRemove: (code: string) => void;
  };
  /** The payment block, shown under the totals once the draft has a price. */
  children?: ReactNode;
}

/** Right-hand column of the counter: the draft, coupons, totals and the payment block. */
export function CounterCartPanel({
  lines,
  quote,
  quoteError,
  pricing,
  disabled,
  onRemove,
  coupons,
  children,
}: CounterCartPanelProps) {
  const aligned = quote?.items.length === lines.length;
  const [couponOpen, setCouponOpen] = useState(false);
  const showCoupon = couponOpen || Boolean(coupons?.codes.length);

  // Light up the line that was just added so the receptionist sees where it went.
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const previousCount = useRef(lines.length);
  const lastKey = lines[lines.length - 1]?.key;
  useEffect(() => {
    if (lines.length > previousCount.current && lastKey) {
      setFreshKey(lastKey);
      const timer = window.setTimeout(() => setFreshKey(null), 1600);
      previousCount.current = lines.length;
      return () => window.clearTimeout(timer);
    }
    previousCount.current = lines.length;
  }, [lines.length, lastKey]);

  const saved = quote ? quote.membershipDiscount + quote.couponDiscount : 0;

  return (
    <section className="flex flex-col rounded-xl border border-sc-border bg-white shadow-xs">
      <header className="flex items-center justify-between gap-2 border-b border-sc-border-soft px-4 py-3">
        <h2 className="m-0 flex items-center gap-2 font-display text-[17px] font-bold tracking-[0.04em] text-sc-ink uppercase">
          <ShoppingBag size={18} />
          Đơn hàng
        </h2>
        <span className="rounded-full bg-sc-paper px-2.5 py-0.5 text-xs font-semibold text-sc-ink-2">
          {lines.length} dịch vụ
        </span>
      </header>

      <div className="flex flex-col gap-3 px-4 py-3">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-sc-paper text-sc-muted">
              <ShoppingBag size={22} />
            </span>
            <b className="text-sc-ink">Đơn đang trống</b>
            <span className="text-[13px] text-sc-muted">Chọn sân, lớp hoặc gói để thêm vào đơn.</span>
          </div>
        ) : (
          <>
            {quoteError && <Alert type="error" showIcon title={quoteError} />}
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {lines.map((line, index) => (
                <LineCard
                  key={line.key}
                  line={line}
                  item={aligned ? quote?.items[index] : undefined}
                  fresh={line.key === freshKey}
                  disabled={disabled}
                  onRemove={() => onRemove(line.key)}
                />
              ))}
            </ul>

            {coupons &&
              (showCoupon ? (
                <CouponInput
                  codes={coupons.codes}
                  quote={quote}
                  check={coupons.check}
                  onAdd={coupons.onAdd}
                  onRemove={coupons.onRemove}
                  disabled={disabled}
                />
              ) : (
                <Button
                  type="link"
                  className="!h-auto !self-start !p-0"
                  icon={<Ticket size={15} />}
                  disabled={disabled}
                  onClick={() => setCouponOpen(true)}
                >
                  Thêm mã giảm giá
                </Button>
              ))}

            {quote ? (
              <div className="flex flex-col border-t border-sc-border-soft pt-2">
                <TotalRow label="Tạm tính" value={formatVND(quote.subtotal)} />
                {quote.membershipDiscount > 0 && (
                  <TotalRow label="Ưu đãi gói" value={`−${formatVND(quote.membershipDiscount)}`} tone="success" />
                )}
                {quote.couponDiscount > 0 && (
                  <TotalRow label="Mã giảm giá" value={`−${formatVND(quote.couponDiscount)}`} tone="success" />
                )}
                <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-sc-border pt-2">
                  <span className="font-semibold text-sc-ink">Phải trả</span>
                  <span className="font-display text-[30px] leading-none font-extrabold tabular-nums text-sc-ink">
                    {formatVND(quote.total)}
                  </span>
                </div>
                {saved > 0 && (
                  <span className="mt-2 self-end rounded-full bg-sc-success/10 px-2.5 py-0.5 text-xs font-semibold text-sc-success">
                    Khách tiết kiệm {formatVND(saved)}
                  </span>
                )}
              </div>
            ) : (
              <p className="m-0 text-[13px] text-sc-muted">{pricing ? 'Đang tính giá…' : ''}</p>
            )}

            {quote && children}
          </>
        )}
      </div>
    </section>
  );
}
