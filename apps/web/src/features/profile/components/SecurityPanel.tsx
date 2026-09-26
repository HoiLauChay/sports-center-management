import { LockOutlined } from '@ant-design/icons';
import { Button, Divider, Form, Input } from 'antd';
import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { FormField, FormRootError } from '~/components/form/FormField';
import { SectionTitle } from '~/components/ui/SectionTitle';
import { useChangePassword, useLogoutAll } from '~/features/auth';

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-x-10 gap-y-4 @2xl:grid-cols-[220px_minmax(0,1fr)]">
      <div>
        <SectionTitle>{title}</SectionTitle>
        <p className="m-0 text-sm leading-[1.55] text-sc-muted">{description}</p>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ChangePasswordForm() {
  const { form, onSubmit, isSubmitting } = useChangePassword();
  const rootError = form.formState.errors.root?.message;

  return (
    <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
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
      <div className="grid gap-x-4 sm:grid-cols-2">
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
      </div>
      <div className="flex justify-end">
        <Button type="primary" htmlType="submit" loading={isSubmitting}>
          Đổi mật khẩu
        </Button>
      </div>
    </Form>
  );
}

export function SecurityPanel() {
  const logoutAll = useLogoutAll();

  return (
    <div className="@container">
      <SettingsSection
        title="Đổi mật khẩu"
        description="Sau khi đổi, bạn sẽ bị đăng xuất khỏi mọi thiết bị và cần đăng nhập lại."
      >
        <ChangePasswordForm />
      </SettingsSection>

      <Divider className="!my-7" />

      <SettingsSection
        title="Phiên đăng nhập"
        description="Nếu nghi ngờ tài khoản bị lộ, hãy đăng xuất khỏi mọi thiết bị rồi đổi mật khẩu."
      >
        <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-red-200 bg-red-50 px-5 py-4">
          <div className="min-w-0 flex-[1_1_220px]">
            <div className="text-sm font-semibold">Đăng xuất khỏi mọi thiết bị</div>
            <div className="mt-0.5 text-[13px] text-sc-muted">
              Mọi phiên đăng nhập, kể cả thiết bị này, sẽ kết thúc ngay.
            </div>
          </div>
          <Button danger icon={<LogOut size={16} />} onClick={logoutAll}>
            Đăng xuất tất cả
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
