import { SafetyOutlined } from '@ant-design/icons';
import { App, Button, Input } from 'antd';
import type { Control, FieldPath, FieldValues, PathValue, UseFormReturn } from 'react-hook-form';
import { useSendOtp } from '../hooks/useSendOtp';
import { emailSchema, OTP_LENGTH } from '../schemas/auth.schema';
import type { OtpPurpose } from '../types';
import { FormField } from './FormField';

interface OtpFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  emailName: FieldPath<T>;
  purpose: OtpPurpose;
  captchaToken: string | null;
  onCaptchaConsumed: () => void;
  label?: string;
}

export function OtpField<T extends FieldValues>({
  form,
  name,
  emailName,
  purpose,
  captchaToken,
  onCaptchaConsumed,
  label = 'Mã xác nhận',
}: OtpFieldProps<T>) {
  const { message } = App.useApp();
  const { send, isSending, countdown } = useSendOtp({
    purpose,
    onEmailError: (msg) => form.setError(emailName, { message: msg }),
    onSent: onCaptchaConsumed,
  });

  const handleSend = () => {
    const parsed = emailSchema.safeParse(form.getValues(emailName));
    if (!parsed.success) {
      form.setError(emailName, { message: parsed.error.issues[0]?.message ?? 'Email không hợp lệ' });
      return;
    }
    form.setValue(emailName, parsed.data as PathValue<T, FieldPath<T>>);
    form.clearErrors(emailName);
    if (!captchaToken) {
      message.warning('Vui lòng hoàn thành xác thực captcha trước');
      return;
    }
    send({ email: parsed.data, captchaToken });
  };

  const disabled = isSending || countdown > 0;

  return (
    <FormField
      control={form.control as Control<T>}
      name={name}
      label={label}
      render={(field, invalid) => (
        <Input
          {...field}
          value={field.value ?? ''}
          status={invalid ? 'error' : undefined}
          prefix={<SafetyOutlined style={{ color: '#9c9890' }} />}
          placeholder="Nhập mã xác nhận"
          inputMode="numeric"
          maxLength={OTP_LENGTH}
          autoComplete="one-time-code"
          suffix={
            <Button
              type="link"
              size="small"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleSend}
              disabled={disabled}
              loading={isSending}
              className="!px-0"
            >
              {countdown > 0 ? `Gửi lại (${countdown}s)` : 'Gửi mã'}
            </Button>
          }
        />
      )}
    />
  );
}
