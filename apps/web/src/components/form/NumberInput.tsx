import { InputNumber, Tooltip, type InputNumberProps } from 'antd';
import { useState, type ComponentProps } from 'react';

type NumberInputProps<T extends number | string = number> = InputNumberProps<T> & {
  ref?: ComponentProps<typeof InputNumber>['ref'];
  invalidMessage?: string;
};

const PLAIN_NUMBER = /^\s*-?\d+(\.\d+)?\s*$/;

export function NumberInput<T extends number | string = number>({
  onInput,
  onBlur,
  onPressEnter,
  onChange,
  status,
  invalidMessage = 'Giá trị không hợp lệ',
  ...props
}: NumberInputProps<T>) {
  const [invalid, setInvalid] = useState(false);
  const isNumber = (text: string) =>
    props.parser ? !Number.isNaN(Number(props.parser(text))) : PLAIN_NUMBER.test(text);
  const dropWrongValue = () => {
    if (invalid) onChange?.(null);
  };

  return (
    <Tooltip open={invalid} title={invalidMessage} placement="bottomLeft">
      <InputNumber<T>
        {...props}
        status={invalid ? 'error' : status}
        aria-invalid={invalid || undefined}
        onChange={onChange}
        onInput={(text) => {
          setInvalid(text.trim() !== '' && !isNumber(text));
          onInput?.(text);
        }}
        onBlur={(event) => {
          dropWrongValue();
          onBlur?.(event);
        }}
        onPressEnter={(event) => {
          dropWrongValue();
          onPressEnter?.(event);
        }}
      />
    </Tooltip>
  );
}
