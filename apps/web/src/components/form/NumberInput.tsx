import { InputNumber, type InputNumberProps } from 'antd';
import type { ComponentProps } from 'react';

type NumberInputProps<T extends number | string = number> = InputNumberProps<T> & {
  ref?: ComponentProps<typeof InputNumber>['ref'];
};

const foreignCharacters = ({ min, precision }: { min?: unknown; precision?: number }) => {
  const negative = min === undefined || Number(min) < 0 ? '\\-' : '';
  const decimal = precision === 0 ? '' : '.,';
  return `[^0-9${negative}${decimal}]`;
};

export function NumberInput<T extends number | string = number>({
  parser,
  onBeforeInput,
  ...props
}: NumberInputProps<T>) {
  const foreign = foreignCharacters(props);
  return (
    <InputNumber<T>
      {...props}
      parser={parser ?? ((text) => (text ?? '').replace(new RegExp(foreign, 'g'), '') as T)}
      onBeforeInput={(event) => {
        const { data } = event.nativeEvent as InputEvent;
        if (data?.length === 1 && new RegExp(foreign).test(data)) event.preventDefault();
        onBeforeInput?.(event);
      }}
    />
  );
}
