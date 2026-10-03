import { MAX_MONEY } from '@sports-center/shared';
import { InputNumber, type InputNumberProps } from 'antd';
import type { ComponentProps } from 'react';

const formatter = (value: number | string | undefined) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const parser = (value: string | undefined) => {
  const digits = (value ?? '').replace(/\./g, '').replace(/\s/g, '');
  return /^-?\d+$/.test(digits) ? Number(digits) : NaN;
};

type MoneyInputProps = Omit<InputNumberProps<number>, 'formatter' | 'parser' | 'precision'> & {
  ref?: ComponentProps<typeof InputNumber>['ref'];
};

/** VND amount input: whole dong only, thousands separated with dots, `₫` suffix. */
export function MoneyInput({ min = 0, max = MAX_MONEY, step = 10000, className, ...props }: MoneyInputProps) {
  return (
    <InputNumber<number>
      {...props}
      min={min}
      max={max}
      step={step}
      precision={0}
      formatter={formatter}
      parser={parser}
      changeOnBlur={false}
      suffix="₫"
      className={`!w-full ${className ?? ''}`}
    />
  );
}
