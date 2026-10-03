import { Button, Input } from 'antd';
import { Ticket } from 'lucide-react';
import { useState } from 'react';
import { formatVND } from '~/lib/format';
import type { Quote } from '../types';

interface CouponInputProps {
  /** Code currently applied to the draft ('' when none). */
  code: string;
  quote: Quote | undefined;
  onApply: (code: string) => void;
  disabled?: boolean;
}

export function CouponInput({ code, quote, onApply, disabled }: CouponInputProps) {
  const [draft, setDraft] = useState(code);
  const applied = quote?.coupon;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
        <Ticket size={16} />
        Mã giảm giá
      </div>
      <CouponField
        value={draft}
        onChange={setDraft}
        onApply={() => onApply(draft)}
        onClear={() => {
          setDraft('');
          onApply('');
        }}
        applied={Boolean(code)}
        disabled={disabled}
      />
      {applied && !applied.valid && <p className="mt-1.5 mb-0 text-[13px] text-sc-error">{applied.error}</p>}
      {applied?.valid && (
        <p className="mt-1.5 mb-0 text-[13px] text-sc-success">
          Đã áp dụng <b>{applied.code}</b>: giảm {formatVND(applied.discount)}. Mỗi đơn dùng một mã.
        </p>
      )}
    </div>
  );
}

interface CouponFieldProps {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
  applied: boolean;
  disabled?: boolean;
}

function CouponField({ value, onChange, onApply, onClear, applied, disabled }: CouponFieldProps) {
  return (
    <div className="flex max-w-sm gap-2">
      <Input
        value={value}
        disabled={disabled}
        placeholder="VD: WELCOME20"
        maxLength={50}
        autoComplete="off"
        className="font-mono uppercase"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        onPressEnter={onApply}
      />
      <Button disabled={disabled || !value.trim()} onClick={onApply}>
        Áp dụng
      </Button>
      {applied && (
        <Button disabled={disabled} onClick={onClear}>
          Bỏ
        </Button>
      )}
    </div>
  );
}
