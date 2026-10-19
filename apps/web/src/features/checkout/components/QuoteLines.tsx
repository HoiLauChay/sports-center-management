import { Alert, Button, Tag } from 'antd';
import { Trash2 } from 'lucide-react';
import { formatVND } from '~/lib/format';
import type { CartLine, Quote, QuoteLine } from '../types';
import { ORDER_ITEM_TYPE_LABEL } from '../types';
import { describeLine } from '../utils';

const BENEFIT_LABEL: Record<string, string> = {
  GYM_ACCESS: 'Gym miễn phí theo gói',
  FREE_SLOT: 'Slot miễn phí theo gói',
  DISCOUNT: 'Giảm giá theo gói',
};

function benefitLabel(item: QuoteLine | undefined) {
  const benefit = item?.snapshot?.benefit;
  return typeof benefit === 'string' ? BENEFIT_LABEL[benefit] : undefined;
}

interface Row {
  line: CartLine;
  item?: QuoteLine;
}

interface QuoteLinesProps {
  lines: CartLine[];
  quote: Quote | undefined;
  /** True while a new quote is on its way (prices shown may be stale). */
  pricing?: boolean;
  onRemove?: (lineKey: string) => void;
  disabled?: boolean;
}

function Breakdown({ item }: { item: QuoteLine }) {
  const parts = [
    item.membershipDiscount > 0 && `Ưu đãi gói −${formatVND(item.membershipDiscount)}`,
    item.couponDiscount > 0 && `Mã ${item.couponCode ? `${item.couponCode} ` : ''}−${formatVND(item.couponDiscount)}`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <div className="flex flex-col items-end gap-0.5 text-[13px] tabular-nums">
      <span className="text-sc-muted line-through">{formatVND(item.subtotal)}</span>
      {parts.map((part) => (
        <span key={part as string} className="text-sc-success">
          {part}
        </span>
      ))}
    </div>
  );
}

export function QuoteLines({ lines, quote, pricing = false, onRemove, disabled }: QuoteLinesProps) {
  const aligned = quote?.items.length === lines.length;
  const rows: Row[] = lines.map((line, index) => ({ line, item: aligned ? quote?.items[index] : undefined }));

  return (
    <ul className={`m-0 list-none p-0 [transition:opacity_0.15s] ${pricing ? 'opacity-60' : ''}`} aria-busy={pricing}>
      {rows.map(({ line, item }) => {
        const description = item ? describeLine(item.type, item.snapshot ?? {}) : null;
        return (
          <li
            key={line.key}
            className="flex items-start gap-3 border-b border-sc-border-soft py-4 first:pt-1 last:border-b-0 last:pb-1"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Tag className="!m-0">{ORDER_ITEM_TYPE_LABEL[line.selection.type]}</Tag>
                <span className="font-semibold [overflow-wrap:anywhere]">{description?.title ?? 'Đang tính giá…'}</span>
              </div>
              {description?.detail && <span className="text-[13px] text-sc-muted">{description.detail}</span>}
              {benefitLabel(item) && (
                <span className="text-[13px] font-semibold text-sc-success">{benefitLabel(item)}</span>
              )}
              {item && !item.valid && (
                <Alert type="error" showIcon className="!mt-1" title={item.error?.message ?? 'Dịch vụ không hợp lệ'} />
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold whitespace-nowrap tabular-nums">{item ? formatVND(item.total) : '…'}</span>
              {item && <Breakdown item={item} />}
            </div>
            {onRemove && (
              <Button
                type="text"
                danger
                disabled={disabled}
                aria-label="Xóa dịch vụ này"
                icon={<Trash2 size={16} />}
                onClick={() => onRemove(line.key)}
                className="-mr-2 shrink-0"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
