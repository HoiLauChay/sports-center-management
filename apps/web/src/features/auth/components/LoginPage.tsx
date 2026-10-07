import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';
import heroImg from '~/assets/images/sports/badminton.jpg';
import { FormField, FormRootError } from '~/components/form/FormField';
import { PATHS } from '~/constants/paths';
import { useLogin } from '../hooks/useAuth';
import { AuthAlt, AuthHeading, AuthLink, AuthShell } from './AuthShell';
import { INPUT_ICON_STYLE } from './inputIcon';

/** Accounts created by `bun db:seed` (apps/api/src/seeds/seed.ts). */
const DEV_PASSWORD = 'Demo@1234';
const DEV_ACCOUNTS = [
  { label: 'Học viên', email: 'member1@sportscenter.local' },
  { label: 'HLV', email: 'coach1@sportscenter.local' },
  { label: 'Quản lý', email: 'manager@sportscenter.local' },
  { label: 'Lễ tân', email: 'reception1@sportscenter.local' },
];

export function LoginPage() {
  const { form, onSubmit, isSubmitting } = useLogin();
  const rootError = form.formState.errors.root?.message;

  return (
    <AuthShell
      visual={{
        image: heroImg,
        imagePosition: '60% 30%',
        kicker: 'Chào mừng trở lại',
        title: 'Sân đang chờ bạn.',
        lead: 'Đăng nhập để đặt sân, xem lịch lớp hôm nay và theo dõi tiến độ tập luyện của bạn.',
        facts: [
          { value: '10', label: 'bộ môn' },
          { value: '15', label: 'sân & phòng tập' },
          { value: '06–22h', label: 'mở cửa hằng ngày' },
        ],
      }}
    >
      <AuthHeading title="Đăng nhập" description="Dùng email đã đăng ký tại quầy hoặc trên trang này." />

      <FormRootError message={rootError} />

      <Form layout="vertical" requiredMark={false} onFinish={() => void onSubmit()}>
        <FormField
          control={form.control}
          name="email"
          label="Email"
          render={(field, invalid) => (
            <Input
              {...field}
              status={invalid ? 'error' : undefined}
              type="email"
              autoComplete="email"
              placeholder="Nhập email của bạn"
              prefix={<MailOutlined style={INPUT_ICON_STYLE} />}
            />
          )}
        />
        <FormField
          control={form.control}
          name="password"
          label="Mật khẩu"
          className="!mb-3"
          render={(field, invalid) => (
            <Input.Password
              {...field}
              status={invalid ? 'error' : undefined}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              prefix={<LockOutlined style={INPUT_ICON_STYLE} />}
            />
          )}
        />

        <div className="-mt-1.5 mb-[18px] flex items-center justify-end text-sm">
          <AuthLink to={PATHS.forgotPassword}>Quên mật khẩu?</AuthLink>
        </div>

        <Button type="primary" htmlType="submit" block loading={isSubmitting}>
          Đăng nhập
        </Button>

        {import.meta.env.DEV && (
          <div className="mt-4 rounded-xl border border-dashed border-sc-primary-border bg-orange-50/50 p-3 text-xs">
            <div className="mb-2 font-bold text-sc-ink">Đăng nhập nhanh (tài khoản seed, chỉ hiện khi dev):</div>
            <div className="grid grid-cols-2 gap-2">
              {DEV_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  size="small"
                  className="!text-xs"
                  onClick={() => {
                    form.setValue('email', account.email);
                    form.setValue('password', DEV_PASSWORD);
                    void onSubmit();
                  }}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </Form>

      <AuthAlt>
        Chưa có tài khoản? <AuthLink to={PATHS.register}>Đăng ký tập thử miễn phí</AuthLink>
      </AuthAlt>
    </AuthShell>
  );
}
