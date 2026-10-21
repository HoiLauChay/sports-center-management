import { AUTH } from '~/constants/auth';
import { escapeHtml } from '~/utils/html';

export type ActivationReason = 'CREATED' | 'EMAIL_CHANGED';

const INTROS: Record<ActivationReason, string> = {
  CREATED: 'Quản lý trung tâm đã tạo tài khoản Sports Center cho bạn với email này.',
  EMAIL_CHANGED: 'Quản lý trung tâm đã đổi email đăng nhập Sports Center của bạn sang địa chỉ này.',
};

export const activationTemplate = (fullName: string, url: string, reason: ActivationReason) => {
  const hours = AUTH.ACTIVATION_TTL / 3600;
  const title = 'Kích hoạt tài khoản Sports Center';
  const intro = `${INTROS[reason]} Bấm nút bên dưới để đặt mật khẩu và vào ứng dụng.`;
  const note = `Link có hiệu lực trong ${hours} giờ và chỉ dùng được một lần. Hết hạn thì bạn vẫn đăng nhập bằng email này để nhận mã đặt mật khẩu.`;

  return {
    subject: `[Sports Center] ${title}`,
    text: `Xin chào ${fullName},\n\n${intro}\n\n${url}\n\n${note}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${title}</h2>
        <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>${intro}</p>
        <p style="margin:24px 0">
          <a href="${escapeHtml(url)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px">Kích hoạt tài khoản</a>
        </p>
        <p style="color:#666;font-size:13px">${note}</p>
        <p style="color:#666;font-size:13px;word-break:break-all">Nút không bấm được thì mở link: ${escapeHtml(url)}</p>
      </div>
    `,
  };
};
