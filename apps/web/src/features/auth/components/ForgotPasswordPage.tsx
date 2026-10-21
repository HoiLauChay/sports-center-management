import { MailOutlined } from '@ant-design/icons';
import { Link, useRouterState } from '@tanstack/react-router';
import { App, Button, Form, Input, Result } from 'antd';
import { useRef } from 'react';
import heroImg from '~/assets/images/sports/swim.jpg';
import { FormField, FormRootError } from '~/components/form/FormField';
import { PATHS } from '~/constants/paths';
import { useCaptchaToken } from '../hooks/useCaptchaToken';
import { usePasswordResetFlow } from '../hooks/usePasswordResetFlow';
import { AuthAlt, AuthHeading, AuthLink, AuthShell } from './AuthShell';
import { CaptchaField, type CaptchaHandle } from './CaptchaField';
import { INPUT_ICON_STYLE } from './inputIcon';
import { NewPasswordStep } from './NewPasswordStep';
import { OtpStep } from './OtpStep';

export function ForgotPasswordPage() {
  const { message } = App.useApp();
  const resetEmail = useRouterState({ select: (s) => s.location.state.resetEmail });
  const flow = usePasswordResetFlow(resetEmail);
  const { step } = flow;
  const captchaRef = useRef<CaptchaHandle>(null);
  const [captchaToken, setCaptchaToken] = useCaptchaToken();

  const consumeCaptcha = () => {
    const token = captchaToken;
    captchaRef.current?.reset();
    return token;
  };

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
      {step.kind === 'email' && (
        <>
          <AuthHeading
            title="Đặt lại mật khẩu"
            description="Nhập email bạn dùng khi đăng ký, chúng tôi gửi mã xác nhận để đặt mật khẩu mới."
          />
          <FormRootError message={flow.emailForm.formState.errors.root?.message} />
          <Form
            layout="vertical"
            requiredMark={false}
            onFinish={() => {
              if (!captchaToken) {
                message.warning('Vui lòng hoàn thành xác thực captcha trước');
                return;
              }
              void flow.submitEmail(consumeCaptcha()!)();
            }}
          >
            <FormField
              control={flow.emailForm.control}
              name="email"
              label="Email"
              render={(field, invalid) => (
                <Input
                  {...field}
                  autoFocus
                  status={invalid ? 'error' : undefined}
                  type="email"
                  autoComplete="email"
                  placeholder="Nhập email của bạn"
                  prefix={<MailOutlined style={INPUT_ICON_STYLE} />}
                />
              )}
            />
            <CaptchaField ref={captchaRef} onToken={setCaptchaToken} />
            <Button type="primary" htmlType="submit" block loading={flow.sending}>
              Gửi mã xác nhận
            </Button>
          </Form>
          <AuthAlt>
            Nhớ mật khẩu? <AuthLink to={PATHS.login}>Đăng nhập</AuthLink>
          </AuthAlt>
        </>
      )}

      {step.kind === 'otp' && (
        <OtpStep
          email={step.email}
          purpose="PASSWORD_RESET"
          initialCountdown={step.countdown}
          onBack={() => flow.setStep({ kind: 'email' })}
          onVerified={(otp) => flow.setStep({ kind: 'password', email: step.email, otp })}
          onResend={() => flow.resend(step.email, consumeCaptcha()!)}
          resendReady={Boolean(captchaToken)}
          beforeResend={<CaptchaField ref={captchaRef} onToken={setCaptchaToken} />}
          footer={
            <>
              Nhớ mật khẩu? <AuthLink to={PATHS.login}>Đăng nhập</AuthLink>
            </>
          }
        />
      )}

      {step.kind === 'password' && (
        <NewPasswordStep
          title="Mật khẩu mới"
          description="Đặt mật khẩu mới cho tài khoản của bạn. Mọi thiết bị đang đăng nhập sẽ bị đăng xuất."
          submitLabel="Đặt lại mật khẩu"
          submitting={flow.resetting}
          error={flow.resetError}
          onSubmit={flow.submitNewPassword}
        />
      )}

      {step.kind === 'done' && (
        <Result
          status="success"
          title="Đặt lại mật khẩu thành công"
          subTitle="Bạn có thể đăng nhập bằng mật khẩu mới. Các phiên đăng nhập cũ đã được đăng xuất."
          extra={
            <Link to={PATHS.login}>
              <Button type="primary">Về trang đăng nhập</Button>
            </Link>
          }
        />
      )}
    </AuthShell>
  );
}
