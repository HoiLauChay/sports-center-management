import { AUTH } from '~/constants/auth';
import { renderEmail } from '~/templates/email/layout';

export type ActivationReason = 'CREATED' | 'EMAIL_CHANGED';

const INTROS: Record<ActivationReason, string> = {
  CREATED: 'Quản lý trung tâm đã tạo tài khoản Sports Center cho bạn với email này.',
  EMAIL_CHANGED: 'Quản lý trung tâm đã đổi email đăng nhập Sports Center của bạn sang địa chỉ này.',
};

export const activationTemplate = (fullName: string, url: string, reason: ActivationReason) => {
  const hours = AUTH.ACTIVATION_TTL / 3600;
  const title = 'Kích hoạt tài khoản Sports Center';

  return renderEmail({
    subject: `[Sports Center] ${title}`,
    preheader: `Đặt mật khẩu để bắt đầu dùng Sports Center. Link có hiệu lực trong ${hours} giờ.`,
    eyebrow: 'Tài khoản',
    title,
    greeting: `Xin chào ${fullName},`,
    paragraphs: [`${INTROS[reason]} Bấm nút bên dưới để đặt mật khẩu và vào ứng dụng.`],
    action: { label: 'Kích hoạt tài khoản', url },
    notes: [
      `Link có hiệu lực trong ${hours} giờ và chỉ dùng được một lần. Hết hạn thì bạn vẫn đăng nhập bằng email này để nhận mã đặt mật khẩu.`,
      `Nút không bấm được thì mở link: ${url}`,
    ],
  });
};
