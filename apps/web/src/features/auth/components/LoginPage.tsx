import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Form, Input } from 'antd';
import heroImg from '~/assets/images/sports/badminton.jpg';
import { FormField, FormRootError } from '~/components/form/FormField';
import { PATHS } from '~/constants/paths';
import { useLoginFlow } from '../hooks/useLoginFlow';
import { AuthAlt, AuthHeading, AuthLink, AuthShell } from './AuthShell';
import { INPUT_ICON_STYLE } from './inputIcon';
import { NewPasswordStep } from './NewPasswordStep';
import { OtpStep } from './OtpStep';

export function LoginPage() {
  const flow = useLoginFlow();
  const { step } = flow;

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
      {step.kind === 'email' && (
        <>
          <AuthHeading title="Đăng nhập" description="Dùng email đã đăng ký tại quầy hoặc trên trang này." />
          <FormRootError message={flow.emailForm.formState.errors.root?.message} />
          <Form layout="vertical" requiredMark={false} onFinish={() => void flow.submitEmail()}>
            <FormField
              control={flow.emailForm.control}
              name="email"
              label="Email"
              className="!mb-[18px]"
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
            <Button type="primary" htmlType="submit" block loading={flow.starting}>
              Tiếp theo
            </Button>
          </Form>
          <AuthAlt>
            Chưa có tài khoản? <AuthLink to={PATHS.register}>Đăng ký tập thử miễn phí</AuthLink>
          </AuthAlt>
        </>
      )}

      {step.kind === 'password' && (
        <>
          <AuthHeading
            title="Đăng nhập"
            description={
              <>
                <b className="break-all text-sc-ink">{step.email}</b>{' '}
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-sc-primary hover:underline"
                  onClick={() => flow.setStep({ kind: 'email' })}
                >
                  Đổi email
                </button>
              </>
            }
          />
          <FormRootError message={flow.passwordForm.formState.errors.root?.message} />
          <Form layout="vertical" requiredMark={false} onFinish={() => void flow.submitPassword()}>
            <input type="email" name="email" value={step.email} autoComplete="username" readOnly hidden />
            <FormField
              control={flow.passwordForm.control}
              name="password"
              label="Mật khẩu"
              className="!mb-3"
              render={(field, invalid) => (
                <Input.Password
                  {...field}
                  autoFocus
                  status={invalid ? 'error' : undefined}
                  autoComplete="current-password"
                  placeholder="Nhập mật khẩu"
                  prefix={<LockOutlined style={INPUT_ICON_STYLE} />}
                />
              )}
            />
            <div className="-mt-1.5 mb-5 flex items-center justify-end text-[15px]">
              <AuthLink to={PATHS.forgotPassword}>Quên mật khẩu?</AuthLink>
            </div>
            <Button type="primary" htmlType="submit" block loading={flow.loggingIn}>
              Đăng nhập
            </Button>
          </Form>
        </>
      )}

      {step.kind === 'otp' && (
        <OtpStep
          email={step.email}
          purpose="ACCOUNT_SETUP"
          initialCountdown={step.countdown}
          onBack={() => flow.setStep({ kind: 'email' })}
          onVerified={(otp) => flow.setStep({ kind: 'set', email: step.email, otp })}
          onResend={() => flow.resend(step.email)}
        />
      )}

      {step.kind === 'set' && (
        <NewPasswordStep
          title="Đặt mật khẩu"
          description="Tài khoản của bạn chưa có mật khẩu. Đặt mật khẩu để dùng cho những lần đăng nhập sau."
          submitLabel="Đặt mật khẩu và đăng nhập"
          submitting={flow.settingPassword}
          error={flow.newPasswordError}
          onSubmit={flow.submitNewPassword}
        />
      )}
    </AuthShell>
  );
}
