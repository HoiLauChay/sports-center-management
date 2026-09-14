import { AUTH } from '~/constants/auth';
import type { OtpPurpose } from '~/generated/prisma/client';

const TITLES: Record<OtpPurpose, string> = {
  REGISTER: 'Mã xác nhận đăng ký tài khoản',
  PASSWORD_RESET: 'Mã xác nhận đặt lại mật khẩu',
};

export const otpTemplate = (purpose: OtpPurpose, code: string) => {
  const minutes = AUTH.OTP_TTL / 60;
  const title = TITLES[purpose];

  return {
    subject: `[Sports Center] ${title}`,
    text: `${title}: ${code}. Mã có hiệu lực trong ${minutes} phút. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${title}</h2>
        <p>Mã xác nhận của bạn là:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">${code}</p>
        <p>Mã có hiệu lực trong <strong>${minutes} phút</strong>.</p>
        <p style="color:#666;font-size:13px">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
      </div>
    `,
  };
};
