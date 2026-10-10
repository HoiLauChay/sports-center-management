import { ORDER_ITEM_TYPES } from '@sports-center/shared';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Tag } from 'antd';
import { Ticket } from 'lucide-react';
import { useState } from 'react';
import { formatVND } from '~/lib/format';
import { describeApiError } from '~/lib/http-errors';
import type { Quote } from '../types';

const MAX_CODES = ORDER_ITEM_TYPES.length;

interface CouponInputProps {
  /** Codes kept on the draft, in the order they were entered. */
  codes: string[];
  quote: Quote | undefined;
  /** Prices the draft with these codes, so a new code is checked before it is kept. */
  check: (codes: string[]) => Promise<Quote>;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
  disabled?: boolean;
}

/**
 * One box for every code of the order. A code is kept on the draft only when the server accepts it, so a wrong code
 * shows its reason and never blocks payment. The server picks which codes apply: each service takes at most one.
 */
export function CouponInput({ codes, quote, check, onAdd, onRemove, disabled }: CouponInputProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = useMutation({
    mutationFn: (code: string) => check([...codes, code]),
    onSuccess: (checked, code) => {
      const result = checked.coupons.find((entry) => entry.code === code);
      if (result && !result.valid) {
        setError(`${code}: ${result.error ?? 'Mã giảm giá không hợp lệ'}`);
        return;
      }
      onAdd(code);
      setDraft('');
      setError(null);
    },
    onError: (err) => setError(describeApiError(err)),
  });

  const submit = () => {
    const code = draft.trim().toUpperCase();
    if (!code) return;
    if (codes.includes(code)) {
      setError(`${code} đã có trong đơn`);
      return;
    }
    apply.mutate(code);
  };

  const full = codes.length >= MAX_CODES;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 font-semibold">
        <Ticket size={16} />
        Mã giảm giá
      </div>
      <div className="flex max-w-sm gap-2">
        <Input
          value={draft}
          disabled={disabled || full}
          placeholder={full ? `Tối đa ${MAX_CODES} mã mỗi đơn` : 'VD: WELCOME20'}
          maxLength={50}
          autoComplete="off"
          className="font-mono uppercase"
          status={error ? 'error' : undefined}
          onChange={(event) => {
            setDraft(event.target.value.toUpperCase());
            setError(null);
          }}
          onPressEnter={submit}
        />
        <Button disabled={disabled || full || !draft.trim()} loading={apply.isPending} onClick={submit}>
          Áp dụng
        </Button>
      </div>
      {error && <p className="mt-1.5 mb-0 text-[13px] text-sc-error">{error}</p>}
      {codes.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {codes.map((code) => {
            const result = quote?.coupons.find((entry) => entry.code === code);
            const color = !result ? undefined : !result.valid ? 'error' : result.applied ? 'success' : 'warning';
            return (
              <div key={code} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Tag
                  color={color}
                  className="!m-0 font-mono"
                  closable={!disabled}
                  onClose={(event) => {
                    event.preventDefault();
                    onRemove(code);
                  }}
                >
                  {code}
                </Tag>
                {result?.applied && <span className="text-sc-success">Giảm {formatVND(result.discount)}</span>}
                {result && !result.applied && (
                  <span className={result.valid ? 'text-sc-muted' : 'text-sc-error'}>{result.error}</span>
                )}
              </div>
            );
          })}
          <p className="m-0 text-xs text-sc-muted-2">
            Mỗi dịch vụ chỉ áp một mã; hệ thống tự chọn các mã giảm nhiều nhất cho đơn.
          </p>
        </div>
      )}
    </div>
  );
}
