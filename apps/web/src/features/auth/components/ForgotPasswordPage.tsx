import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link } from '@tanstack/react-router';
import { Button, Form, Input, Result } from 'antd';
import { useRef } from 'react';
import heroImg from '~/assets/images/sports/swim.jpg';
import { PATHS } from '~/constants/paths';
import { useResetPassword } from '../hooks/useAuth';
import { useCaptchaToken } from '../hooks/useCaptchaToken';
import { AuthAlt, AuthHeading, AuthLink, AuthShell } from './AuthShell';
import { CaptchaField, type CaptchaHandle } from './CaptchaField';
import { FormField, FormRootError } from './FormField';
import { OtpField } from './OtpField';

const ICON_COLOR = '#9c9890';

export function ForgotPasswordPage() {
  const { form, onSubmit, isSubmitting, done, reset } = useResetPassword();
  const rootError = form.formState.errors.root?.message;
  const captchaRef = useRef<CaptchaHandle>(null);
  const [captchaToken, setCaptchaToken] = useCaptchaToken();

  return (
    <AuthShell
      visual={{
        image: heroImg,
        imagePosition: 'center 45%',
        kicker: 'Hỗ trợ tài khoản',
        title: 'Quên mật khẩu? Không sao.',
        lead: 'Nhập email đã đăng ký, chúng tôi gửi mã xác nhận trong vài giây. Hoặc ghé quầy, nhân viên đặt lại giúp bạn ngay.',
        facts: [
          { value: '06–22h', label: 'quầy hỗ trợ' },
          { value: '0901 000 002', label: 'hotline' },
          { value: 'hello@sc.vn', label: 'email' },
        ],
      }}
    >
      {done ? (
        <Result
          status="success"
          title="Đặt lại mật khẩu thành công"
          subTitle="Bạn có thể đăng nhập bằng mật khẩu mới. Các phiên đăng nhập cũ đã được đăng xuất."
          extra={[
            <Link key="login" to={PATHS.login}>
              <Button type="primary">Về trang đăng nhập</Button>
            </Link>,
            <Button key="again" onClick={reset}>
              Đặt lại lần nữa
            </Button>,
          ]}
        />
      ) : (
        <>
          <AuthHeading
            title="Đặt lại mật khẩu"
            description="Nhập email bạn dùng khi đăng ký, nhận mã xác nhận rồi đặt mật khẩu mới."
          />

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

            <CaptchaField ref={captchaRef} onToken={setCaptchaToken} />

            <OtpField
              form={form}
              name="otp"
              emailName="email"
              purpose="PASSWORD_RESET"
              captchaToken={captchaToken}
              onCaptchaConsumed={() => captchaRef.current?.reset()}
            />

            <FormField
              control={form.control}
              name="password"
              label="Mật khẩu mới"
              render={(field, invalid) => (
                <Input.Password
                  {...field}
                  status={invalid ? 'error' : undefined}
                  autoComplete="new-password"
                  placeholder="Ít nhất 8 ký tự, gồm chữ và số"
                  prefix={<LockOutlined style={{ color: ICON_COLOR }} />}
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
                  prefix={<LockOutlined style={{ color: ICON_COLOR }} />}
                />
              )}
            />

            <Button type="primary" htmlType="submit" block loading={isSubmitting}>
              Đặt lại mật khẩu
            </Button>
          </Form>

          <AuthAlt>
            <AuthLink to={PATHS.login}>← Quay lại đăng nhập</AuthLink>
          </AuthAlt>
        </>
      )}
    </AuthShell>
  );
}
