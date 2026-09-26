import { LockOutlined } from '@ant-design/icons';
import { Button, Divider, Form, Input } from 'antd';
import { LogOut } from 'lucide-react';
import { FormField, FormRootError } from '~/components/form/FormField';
import { useChangePassword, useLogoutAll } from '~/features/auth';

function ChangePasswordForm() {
  const { form, onSubmit, isSubmitting } = useChangePassword();
  const rootError = form.formState.errors.root?.message;

  return (
    <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()} className="max-w-md">
      <FormRootError message={rootError} />
      <FormField
        control={form.control}
        name="currentPassword"
        label="Mật khẩu hiện tại"
        render={(field, invalid) => (
          <Input.Password
            {...field}
            status={invalid ? 'error' : undefined}
            autoComplete="current-password"
            prefix={<LockOutlined />}
          />
        )}
      />
      <FormField
        control={form.control}
        name="password"
        label="Mật khẩu mới"
        extra="Tối thiểu 8 ký tự, gồm chữ và số"
        render={(field, invalid) => (
          <Input.Password
            {...field}
            status={invalid ? 'error' : undefined}
            autoComplete="new-password"
            prefix={<LockOutlined />}
          />
        )}
      />
      <FormField
        control={form.control}
        name="confirmPassword"
        label="Nhập lại mật khẩu mới"
        render={(field, invalid) => (
          <Input.Password
            {...field}
            status={invalid ? 'error' : undefined}
            autoComplete="new-password"
            prefix={<LockOutlined />}
          />
        )}
      />
      <Button type="primary" htmlType="submit" loading={isSubmitting}>
        Đổi mật khẩu
      </Button>
    </Form>
  );
}

export function SecurityPanel() {
  const logoutAll = useLogoutAll();

  return (
    <>
      <h3 className="mt-0 mb-1 text-base font-semibold">Đổi mật khẩu</h3>
      <p className="mt-0 mb-4 text-sc-muted">
        Sau khi đổi, bạn sẽ bị đăng xuất khỏi mọi thiết bị và cần đăng nhập lại.
      </p>
      <ChangePasswordForm />

      <Divider />

      <h3 className="mt-0 mb-1 text-base font-semibold">Phiên đăng nhập</h3>
      <p className="mt-0 mb-4 text-sc-muted">
        Nếu nghi ngờ tài khoản bị lộ, hãy đăng xuất khỏi mọi thiết bị rồi đổi mật khẩu.
      </p>
      <Button danger icon={<LogOut size={16} />} onClick={logoutAll}>
        Đăng xuất khỏi mọi thiết bị
      </Button>
    </>
  );
}
