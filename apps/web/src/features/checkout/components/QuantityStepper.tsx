import { MAX_PRODUCT_QUANTITY } from '@sports-center/shared';
import { InputNumber } from 'antd';

interface QuantityStepperProps {
  value: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
  max?: number;
  label?: string;
}

/** Quantity of a product line: − / + buttons around a number, 1 … 99. */
export function QuantityStepper({
  value,
  onChange,
  disabled,
  max = MAX_PRODUCT_QUANTITY,
  label = 'Số lượng',
}: QuantityStepperProps) {
  return (
    <InputNumber
      size="small"
      mode="spinner"
      min={1}
      max={Math.max(1, Math.min(max, MAX_PRODUCT_QUANTITY))}
      precision={0}
      value={value}
      disabled={disabled}
      aria-label={label}
      className="!w-[104px] shrink-0"
      onChange={(next) => {
        if (typeof next === 'number' && next !== value) onChange(next);
      }}
    />
  );
}
