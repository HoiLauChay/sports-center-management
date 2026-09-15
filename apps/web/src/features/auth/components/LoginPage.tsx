import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';
import heroImg from '~/assets/images/sports/badminton.jpg';
import { PATHS } from '~/constants/paths';
import { useLogin } from '../hooks/useAuth';
import { AuthAlt, AuthHeading, AuthLink, AuthShell } from './AuthShell';
import { FormField, FormRootError } from './FormField';

const ICON_COLOR = '#9c9890';

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

      <Form layout="vertical" size="large" requiredMark={false} onFinish={() => void onSubmit()}>
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
              placeholder="ban@email.com"
              prefix={<MailOutlined style={{ color: ICON_COLOR }} />}
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
              prefix={<LockOutlined style={{ color: ICON_COLOR }} />}
            />
          )}
        />

        <div className="-mt-1.5 mb-[18px] flex items-center justify-end text-sm">
          <AuthLink to={PATHS.forgotPassword}>Quên mật khẩu?</AuthLink>
        </div>

        <Button type="primary" htmlType="submit" block loading={isSubmitting}>
          Đăng nhập
        </Button>
      </Form>

      <AuthAlt>
        Chưa có tài khoản? <AuthLink to={PATHS.register}>Đăng ký tập thử miễn phí</AuthLink>
      </AuthAlt>
    </AuthShell>
  );
}
