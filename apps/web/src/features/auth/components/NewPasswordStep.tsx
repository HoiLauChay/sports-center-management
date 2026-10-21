import { LockOutlined } from '@ant-design/icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { passwordSchema, withPasswordConfirmation } from '@sports-center/shared';
import { Button, Form, Input } from 'antd';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField, FormRootError } from '~/components/form/FormField';
import { AuthHeading } from './AuthShell';
import { INPUT_ICON_STYLE } from './inputIcon';

const newPasswordSchema = withPasswordConfirmation(
  z.object({ password: passwordSchema, confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu') }),
);

export type NewPasswordValues = z.infer<typeof newPasswordSchema>;

interface NewPasswordStepProps {
  title: string;
  description: string;
  submitLabel: string;
  submitting: boolean;
  error?: string | null;
  onSubmit: (values: NewPasswordValues) => void;
}

export function NewPasswordStep({
  title,
  description,
  submitLabel,
  submitting,
  error,
  onSubmit,
}: NewPasswordStepProps) {
  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    mode: 'onTouched',
    defaultValues: { password: '', confirmPassword: '' },
  });

  return (
    <>
      <AuthHeading title={title} description={description} />
      <FormRootError message={error ?? undefined} />
      <Form layout="vertical" requiredMark={false} onFinish={() => void form.handleSubmit(onSubmit)()}>
        <FormField
          control={form.control}
          name="password"
          label="Mật khẩu mới"
          extra="Tối thiểu 8 ký tự, gồm chữ và số"
          render={(field, invalid) => (
            <Input.Password
              {...field}
              autoFocus
              status={invalid ? 'error' : undefined}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu mới"
              prefix={<LockOutlined style={INPUT_ICON_STYLE} />}
            />
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          label="Nhập lại mật khẩu mới"
          className="!mb-[18px]"
          render={(field, invalid) => (
            <Input.Password
              {...field}
              status={invalid ? 'error' : undefined}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              prefix={<LockOutlined style={INPUT_ICON_STYLE} />}
            />
          )}
        />
        <Button type="primary" htmlType="submit" block loading={submitting}>
          {submitLabel}
        </Button>
      </Form>
    </>
  );
}
