import { MAX_MONEY } from '@sports-center/shared';
import type { InputNumberProps } from 'antd';
import type { ComponentProps } from 'react';
import { NumberInput } from '~/components/form/NumberInput';

const formatter = (value: number | string | undefined) => `${value ?? ''}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const parser = (value: string | undefined) => {
  const digits = (value ?? '').replace(/\./g, '').replace(/\s/g, '');
  return /^-?\d+$/.test(digits) ? Number(digits) : NaN;
};

type MoneyInputProps = Omit<InputNumberProps<number>, 'formatter' | 'parser' | 'precision'> & {
  ref?: ComponentProps<typeof NumberInput>['ref'];
};

/** VND amount input: whole dong only, thousands separated with dots, `₫` suffix. */
export function MoneyInput({ min = 0, max = MAX_MONEY, step = 10000, className, ...props }: MoneyInputProps) {
  return (
    <NumberInput<number>
      {...props}
      min={min}
      max={max}
      step={step}
      precision={0}
      formatter={formatter}
      parser={parser}
      changeOnBlur={false}
      suffix="₫"
      invalidMessage="Số tiền không hợp lệ"
      className={`!w-full ${className ?? ''}`}
    />
  );
}
