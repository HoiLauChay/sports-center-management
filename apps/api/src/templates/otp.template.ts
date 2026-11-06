import { AUTH } from '~/constants/auth';
import type { OtpPurpose } from '~/generated/prisma/client';
import { renderEmail } from '~/templates/email/layout';

export type CodePurpose = Exclude<OtpPurpose, 'ACCOUNT_ACTIVATION'>;

const TITLES: Record<CodePurpose, string> = {
  REGISTER: 'Mã xác nhận đăng ký tài khoản',
  PASSWORD_RESET: 'Mã xác nhận đặt lại mật khẩu',
  ACCOUNT_SETUP: 'Mã xác nhận đặt mật khẩu tài khoản',
};

const INTROS: Record<CodePurpose, string> = {
  REGISTER: 'Cảm ơn bạn đã đăng ký tài khoản Sports Center. Nhập mã dưới đây để xác nhận email và hoàn tất đăng ký.',
  PASSWORD_RESET:
    'Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Sports Center gắn với email này. Nhập mã dưới đây để tiếp tục.',
  ACCOUNT_SETUP: 'Nhập mã dưới đây để đặt mật khẩu và bắt đầu dùng tài khoản Sports Center của bạn.',
};

export const otpTemplate = (purpose: CodePurpose, code: string) => {
  const minutes = AUTH.OTP_TTL / 60;
  const title = TITLES[purpose];

  return renderEmail({
    subject: `[Sports Center] ${title}`,
    preheader: `Mã ${code} có hiệu lực trong ${minutes} phút. Không chia sẻ mã này với bất kỳ ai.`,
    eyebrow: 'Bảo mật tài khoản',
    title,
    paragraphs: [INTROS[purpose]],
    code,
    details: [{ label: 'Hiệu lực', value: `${minutes} phút` }],
    notes: [
      'Sports Center không bao giờ hỏi mã này qua điện thoại hay tin nhắn. Đừng chia sẻ mã với bất kỳ ai.',
      'Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email. Tài khoản của bạn vẫn an toàn.',
    ],
  });
};
