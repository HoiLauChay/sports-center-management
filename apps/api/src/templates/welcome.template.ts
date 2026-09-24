import { escapeHtml } from '~/utils/html';

export const welcomeTemplate = (fullName: string) => {
  const title = 'Chào mừng bạn đến với Sports Center';

  return {
    subject: `[Sports Center] ${title}`,
    text: `Xin chào ${fullName}, tài khoản của bạn đã được tạo thành công. Bạn có thể đặt sân, đăng ký lớp học và mua gói thành viên ngay trên hệ thống.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${title}</h2>
        <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
        <p>Tài khoản của bạn đã được tạo thành công. Bạn có thể đặt sân, đăng ký lớp học và mua gói thành viên ngay trên hệ thống.</p>
      </div>
    `,
  };
};
