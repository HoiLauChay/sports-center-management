import type { PaymentMethod } from '@sports-center/shared';
import { Button, InputNumber } from 'antd';
import { Banknote, CreditCard, QrCode, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { formatVND } from '~/lib/format';
import { cashSuggestions } from '../utils';

export type CounterMethod = Extract<PaymentMethod, 'CASH' | 'CARD' | 'TRANSFER'>;

const METHODS: { value: CounterMethod; icon: LucideIcon }[] = [
  { value: 'CASH', icon: Banknote },
  { value: 'CARD', icon: CreditCard },
  { value: 'TRANSFER', icon: QrCode },
];

const shortVND = (value: number) =>
  value >= 1_000_000 && value % 100_000 === 0
    ? `${value / 1_000_000}tr`
    : value % 1000 === 0
      ? `${value / 1000}k`
      : formatVND(value);

interface CounterPaymentPanelProps {
  total: number;
  method: CounterMethod;
  onMethod: (method: CounterMethod) => void;
  /** Cash handed over by the customer; `null` means "exact amount". */
  tendered: number | null;
  onTendered: (value: number | null) => void;
  canPay: boolean;
  blockedReason?: string;
  busy?: boolean;
  onPay: () => void;
  /** Overrides the text of the big button per method (counter order wording by default). */
  actionLabel?: (method: CounterMethod) => string;
  /** Overrides the short explanation under the card / transfer tiles. */
  hints?: Partial<Record<'CARD' | 'TRANSFER', ReactNode>>;
  /** Extra fields shown above the button (e.g. a note). */
  children?: ReactNode;
}

/** Payment method tiles, cash tendered / change, and the one big "collect" button. */
export function CounterPaymentPanel({
  total,
  method,
  onMethod,
  tendered,
  onTendered,
  canPay,
  blockedReason,
  busy,
  onPay,
  actionLabel,
  hints,
  children,
}: CounterPaymentPanelProps) {
  const free = total === 0;
  const short = method === 'CASH' && tendered !== null && tendered < total;
  const change = method === 'CASH' && tendered !== null ? tendered - total : 0;
  const disabled = !canPay || short || (method === 'TRANSFER' && free);

  const label = actionLabel
    ? actionLabel(method)
    : method === 'TRANSFER'
      ? 'Tạo mã QR'
      : method === 'CARD'
        ? 'Xác nhận đã quẹt thẻ'
        : free
          ? 'Xác nhận đơn'
          : 'Thu tiền';

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Phương thức thanh toán">
        {METHODS.map(({ value, icon: Icon }, index) => {
          const active = method === value;
          const unavailable = value === 'TRANSFER' && free;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy || unavailable}
              title={unavailable ? 'Đơn 0đ không cần chuyển khoản' : `Alt+${index + 1}`}
              onClick={() => onMethod(value)}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                active
                  ? 'border-sc-primary bg-sc-primary-soft text-sc-primary shadow-[inset_0_0_0_1px_var(--sc-primary)]'
                  : 'border-sc-border bg-white text-sc-ink-2 hover:border-sc-primary-border'
              }`}
            >
              <Icon size={20} />
              {PAYMENT_METHOD_LABEL[value]}
            </button>
          );
        })}
      </div>

      {method === 'CASH' && !free && (
        <div className="flex flex-col gap-2 rounded-lg bg-sc-paper px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-sc-ink-2">Khách đưa</span>
            <InputNumber<number>
              className="!w-40"
              min={0}
              step={10_000}
              value={tendered}
              disabled={busy}
              placeholder={total.toLocaleString('vi-VN')}
              controls={false}
              formatter={(value) => (value ? Number(value).toLocaleString('vi-VN') : '')}
              parser={(value) => Number((value ?? '').replace(/\D/g, '')) || 0}
              suffix="đ"
              onChange={(value) => onTendered(value ?? null)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <Button size="small" disabled={busy} onClick={() => onTendered(null)}>
              Đủ tiền
            </Button>
            {cashSuggestions(total).map((value) => (
              <Button key={value} size="small" disabled={busy} onClick={() => onTendered(value)}>
                {shortVND(value)}
              </Button>
            ))}
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-sc-border pt-2">
            <span className="text-[13px] font-semibold text-sc-ink-2">{short ? 'Còn thiếu' : 'Tiền thối lại'}</span>
            <span
              className={`font-display text-[24px] font-extrabold tabular-nums ${
                short ? 'text-sc-error' : change > 0 ? 'text-sc-accent' : 'text-sc-muted'
              }`}
            >
              {formatVND(Math.abs(change))}
            </span>
          </div>
        </div>
      )}

      {method === 'CARD' && (
        <p className="m-0 rounded-lg bg-sc-paper px-3 py-2.5 text-[13px] text-sc-ink-2">
          {hints?.CARD ?? (
            <>
              Quẹt thẻ <b>{formatVND(total)}</b> trên máy POS, khi máy báo thành công thì bấm xác nhận.
            </>
          )}
        </p>
      )}
      {method === 'TRANSFER' && !free && (
        <p className="m-0 rounded-lg bg-sc-paper px-3 py-2.5 text-[13px] text-sc-ink-2">
          {hints?.TRANSFER ?? 'Hệ thống tạo mã QR để khách quét. Đơn hoàn tất khi tiền về tài khoản.'}
        </p>
      )}

      {children}

      {!canPay && blockedReason && <p className="m-0 text-[13px] text-sc-error">{blockedReason}</p>}

      <Button
        type="primary"
        size="large"
        block
        loading={busy}
        disabled={disabled}
        onClick={onPay}
        className="!h-14 !text-[17px] !font-bold"
      >
        <span className="flex w-full items-center justify-between gap-3">
          <span>{label}</span>
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{formatVND(total)}</span>
            <kbd className="counter-kbd counter-kbd-on-primary">Ctrl ↵</kbd>
          </span>
        </span>
      </Button>
    </div>
  );
}
