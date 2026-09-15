import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Checkbox, Form, Input } from 'antd';
import { useRef } from 'react';
import heroImg from '~/assets/images/sports/gym.jpg';
import { PATHS } from '~/constants/paths';
import { useRegister } from '../hooks/useAuth';
import { useCaptchaToken } from '../hooks/useCaptchaToken';
import { AuthAlt, AuthHeading, AuthLink, AuthShell } from './AuthShell';
import { CaptchaField, type CaptchaHandle } from './CaptchaField';
import { FormField, FormRootError } from './FormField';
import { INPUT_ICON_STYLE } from './inputIcon';
import { OtpField } from './OtpField';

export function RegisterPage() {
  const { form, onSubmit, isSubmitting } = useRegister();
  const rootError = form.formState.errors.root?.message;
  const captchaRef = useRef<CaptchaHandle>(null);
  const [captchaToken, setCaptchaToken] = useCaptchaToken();

  return (
    <AuthShell
      width={480}
      visual={{
        image: heroImg,
        imagePosition: 'center 40%',
        kicker: 'Thành viên mới',
        title: 'Buổi đầu tiên miễn phí.',
        lead: 'Tạo tài khoản trong một phút bằng email, chọn môn bạn muốn thử, đến tập — chưa cần mua gói.',
        steps: [
          'Nhập email, nhận mã xác nhận trong hộp thư',
          'Đặt mật khẩu, tạo tài khoản',
          'Chọn lớp hoặc sân muốn thử ngay trên app',
        ],
      }}
    >
      <AuthHeading title="Tạo tài khoản" description="Miễn phí. Không phí gia nhập, không ràng buộc thời hạn." />

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

        <CaptchaField ref={captchaRef} onToken={setCaptchaToken} />

        <OtpField
          form={form}
          name="otp"
          emailName="email"
          purpose="REGISTER"
          captchaToken={captchaToken}
          onCaptchaConsumed={() => captchaRef.current?.reset()}
        />

        <FormField
          control={form.control}
          name="password"
          label="Mật khẩu"
          extra="Tối thiểu 8 ký tự, gồm chữ và số"
          render={(field, invalid) => (
            <Input.Password
              {...field}
              status={invalid ? 'error' : undefined}
              autoComplete="new-password"
              placeholder="Nhập mật khẩu"
              prefix={<LockOutlined style={INPUT_ICON_STYLE} />}
            />
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          label="Nhập lại mật khẩu"
          render={(field, invalid) => (
            <Input.Password
              {...field}
              status={invalid ? 'error' : undefined}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu"
              prefix={<LockOutlined style={INPUT_ICON_STYLE} />}
            />
          )}
        />

        <FormField
          control={form.control}
          name="agree"
          className="!mb-[18px]"
          render={(field) => (
            <Checkbox
              checked={field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              ref={field.ref}
            >
              Tôi đã đọc và đồng ý với <AuthLink to={PATHS.home}>Điều khoản dịch vụ</AuthLink> và{' '}
              <AuthLink to={PATHS.home}>Chính sách bảo mật</AuthLink> của trung tâm.
            </Checkbox>
          )}
        />

        <Button type="primary" htmlType="submit" block loading={isSubmitting}>
          Đăng ký
        </Button>
      </Form>

      <AuthAlt>
        Đã có tài khoản? <AuthLink to={PATHS.login}>Đăng nhập</AuthLink>
      </AuthAlt>
    </AuthShell>
  );
}
