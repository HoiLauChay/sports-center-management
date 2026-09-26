import { Form } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

interface FormFieldProps<T extends FieldValues, N extends FieldPath<T>> {
  control: Control<T>;
  name: N;
  label?: ReactNode;
  extra?: ReactNode;
  className?: string;
  render: (field: ControllerRenderProps<T, N>, invalid: boolean) => ReactElement;
}

export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  extra,
  className,
  render,
}: FormFieldProps<T, N>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Form.Item
          label={label}
          extra={extra}
          className={[
            className,
            extra
              ? '[&_.ant-form-item-extra]:!mt-0.5 [&_.ant-form-item-extra]:!min-h-0 [&_.ant-form-item-extra]:!text-[13px] [&_.ant-form-item-extra]:!leading-[18px]'
              : '',
          ]
            .filter(Boolean)
            .join(' ')}
          validateStatus={fieldState.error ? 'error' : undefined}
          help={fieldState.error?.message}
        >
          {render(field, Boolean(fieldState.error))}
        </Form.Item>
      )}
    />
  );
}

export function FormRootError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
      {message}
    </div>
  );
}
