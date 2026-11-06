import type { PaymentMethod } from '@sports-center/shared';
import { Button, InputNumber } from 'antd';
import { Banknote, QrCode, Wallet, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PAYMENT_METHOD_LABEL } from '~/constants/payment';
import { formatVND } from '~/lib/format';
import '../counter.css';
import { cashSuggestions } from '../utils';

export type CounterMethod = Extract<PaymentMethod, 'CASH' | 'WALLET' | 'TRANSFER'>;

const METHOD_ICON: Record<CounterMethod, LucideIcon> = {
  CASH: Banknote,
  WALLET: Wallet,
  TRANSFER: QrCode,
};

const shortVND = (value: number) =>
  value >= 1_000_000 && value % 100_000 === 0
    ? `${value / 1_000_000}tr`
    : value % 1000 === 0
      ? `${value / 1000}k`
      : formatVND(value);

interface CounterPaymentPanelProps<M extends CounterMethod> {
  /** The tiles shown, in order (Alt+1, Alt+2, … follow this order). */
  methods: M[];
  total: number;
  /** The member buyer's wallet balance; `null` for a guest, who has no wallet. */
  walletBalance?: number | null;
  /** Null until the cashier picks one: the button stays disabled. */
  method: M | null;
  onMethod: (method: M) => void;
  /** Cash handed over by the customer; `null` means "exact amount". */
  tendered: number | null;
  onTendered: (value: number | null) => void;
  canPay: boolean;
  blockedReason?: string;
  busy?: boolean;
  onPay: () => void;
  /** Overrides the text of the big button per method (counter order wording by default). */
  actionLabel?: (method: M) => string;
  /** Overrides the short explanation under the card / transfer tiles. */
  hints?: Partial<Record<'TRANSFER', ReactNode>>;
  /** Extra fields shown above the button (e.g. a note). */
  children?: ReactNode;
}

/** Payment method tiles, cash tendered / change, and the one big "collect" button. */
export function CounterPaymentPanel<M extends CounterMethod>({
  methods,
  total,
  walletBalance = null,
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
}: CounterPaymentPanelProps<M>) {
  const free = total === 0;
  const short = method === 'CASH' && tendered !== null && tendered < total;
  const change = method === 'CASH' && tendered !== null ? tendered - total : 0;
  const noWallet = walletBalance === null;
  const walletShort = method === 'WALLET' && !noWallet && walletBalance < total;
  const disabled =
    !method || !canPay || short || walletShort || (method === 'TRANSFER' && free) || (method === 'WALLET' && noWallet);

  const label = !method
    ? 'Chọn phương thức thanh toán'
    : actionLabel
      ? actionLabel(method)
      : method === 'TRANSFER'
        ? 'Tạo mã QR'
        : method === 'WALLET'
          ? 'Trừ tiền ví'
          : free
            ? 'Xác nhận đơn'
            : 'Thu tiền';

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}
        role="radiogroup"
        aria-label="Phương thức thanh toán"
      >
        {methods.map((value, index) => {
          const Icon: LucideIcon = METHOD_ICON[value];
          const active = method === value;
          const unavailable = (value === 'TRANSFER' && free) || (value === 'WALLET' && noWallet);
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy || unavailable}
              title={
                !unavailable
                  ? `Alt+${index + 1}`
                  : value === 'WALLET'
                    ? 'Khách vãng lai không có ví'
                    : 'Đơn 0đ không cần chuyển khoản'
              }
              onClick={() => onMethod(value)}
              className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-[14.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
            <span className="text-[14.5px] font-semibold text-sc-ink-2">Khách đưa</span>
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
            <span className="text-[14.5px] font-semibold text-sc-ink-2">{short ? 'Còn thiếu' : 'Tiền thối lại'}</span>
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

      {method === 'WALLET' && !noWallet && (
        <div className="flex flex-col gap-1.5 rounded-lg bg-sc-paper px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14.5px] font-semibold text-sc-ink-2">Số dư ví</span>
            <span className="font-semibold tabular-nums text-sc-ink">{formatVND(walletBalance)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-sc-border pt-2">
            <span className="text-[14.5px] font-semibold text-sc-ink-2">
              {walletShort ? 'Còn thiếu' : 'Sau thanh toán'}
            </span>
            <span
              className={`font-display text-[24px] font-extrabold tabular-nums ${
                walletShort ? 'text-sc-error' : 'text-sc-ink'
              }`}
            >
              {formatVND(Math.abs(walletBalance - total))}
            </span>
          </div>
          {walletShort && (
            <p className="m-0 text-[13.5px] text-sc-error">
              Ví không đủ tiền. Nạp thêm ví hoặc chọn cách thanh toán khác.
            </p>
          )}
        </div>
      )}
      {method === 'TRANSFER' && !free && (
        <p className="m-0 rounded-lg bg-sc-paper px-3 py-2.5 text-[14.5px] text-sc-ink-2">
          {hints?.TRANSFER ?? 'Hệ thống tạo mã QR để khách quét. Đơn hoàn tất khi tiền về tài khoản.'}
        </p>
      )}

      {children}

      {!canPay && blockedReason && <p className="m-0 text-[14.5px] text-sc-error">{blockedReason}</p>}

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
