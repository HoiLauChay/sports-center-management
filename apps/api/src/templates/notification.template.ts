import { escapeHtml } from '~/utils/html';

export const notificationTemplate = (fullName: string, title: string, message: string) => ({
  subject: `[Sports Center] ${title}`,
  text: `Xin chào ${fullName},\n\n${message}`,
  html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
        <h2 style="margin:0 0 16px">${escapeHtml(title)}</h2>
        <p>Xin chào <strong>${escapeHtml(fullName)}</strong>,</p>
        <p style="white-space:pre-line">${escapeHtml(message)}</p>
      </div>
    `,
});
