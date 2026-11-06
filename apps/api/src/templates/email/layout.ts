import { appUrl } from '~/configs/env';
import { RECEIPT_ISSUER } from '~/constants/center';
import { escapeHtml } from '~/utils/html';

// Brand tokens mirrored from apps/web/src/styles/global.css (--sc-*). Email clients ignore CSS variables,
// so every colour is inlined as a literal.
const COLOR = {
  primary: '#0f4d34',
  primaryDark: '#0b3b28',
  primarySoft: '#e3efe8',
  lime: '#d6f24b',
  ink: '#14130f',
  ink2: '#3d3b35',
  paper: '#f2efe8',
  surface: '#ffffff',
  muted: '#7a776f',
  border: '#e2ddd2',
  borderSoft: '#ece8df',
} as const;

const FONT_BODY = "'Barlow', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_DISPLAY = "'Barlow Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif";
const FONT_MONO = "'SFMono-Regular', Menlo, Consolas, 'Courier New', monospace";

export interface EmailDetail {
  label: string;
  value: string;
}

export interface EmailContent {
  subject: string;
  /** Inbox preview line shown after the subject. */
  preheader: string;
  /** Small label above the title, e.g. the notification category. */
  eyebrow?: string;
  title: string;
  greeting?: string;
  /** Plain-text paragraphs; escaped here, money amounts like `150.000đ` are bolded. */
  paragraphs: string[];
  /** One-time code shown in a large box. */
  code?: string;
  details?: EmailDetail[];
  action?: { label: string; url: string };
  /** Small print under the action. */
  notes?: string[];
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Money as the app writes it in messages: `150.000đ`. */
export const MONEY = /\d{1,3}(?:\.\d{3})*đ/g;

const paragraphHtml = (value: string) =>
  escapeHtml(value)
    .replace(MONEY, (amount) => `<strong style="color:${COLOR.ink};white-space:nowrap">${amount}</strong>`)
    .replace(/\r?\n/g, '<br>');

const logoUrl = `${appUrl}/email/logo.png`;

const header = () => `
          <tr>
            <td class="sc-px" style="background-color:${COLOR.primary};padding:22px 40px;border-radius:16px 16px 0 0">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td valign="middle" width="44" style="width:44px;padding-right:12px">
                    <img src="${escapeHtml(logoUrl)}" width="44" height="44" alt="Sports Center" style="display:block;width:44px;height:44px;border:0;outline:none;text-decoration:none">
                  </td>
                  <td valign="middle" style="font-family:${FONT_DISPLAY};font-size:22px;line-height:24px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#ffffff">
                    Sports <span style="color:${COLOR.lime}">Center</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:${COLOR.lime};height:4px;line-height:4px;font-size:0">&nbsp;</td>
          </tr>`;

const eyebrowHtml = (value: string) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">
                <tr>
                  <td style="background-color:${COLOR.primarySoft};border-radius:999px;padding:5px 12px;font-family:${FONT_BODY};font-size:11px;line-height:14px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${COLOR.primary}">${escapeHtml(value)}</td>
                </tr>
              </table>`;

const codeHtml = (code: string) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 24px">
                <tr>
                  <td align="center" style="background-color:${COLOR.paper};border:1px dashed ${COLOR.primary};border-radius:12px;padding:22px 12px">
                    <div style="font-family:${FONT_BODY};font-size:12px;line-height:16px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${COLOR.muted};margin:0 0 8px">Mã xác nhận</div>
                    <div style="font-family:${FONT_MONO};font-size:36px;line-height:44px;font-weight:700;letter-spacing:10px;color:${COLOR.primary};padding-left:10px">${escapeHtml(code)}</div>
                  </td>
                </tr>
              </table>`;

const detailsHtml = (details: EmailDetail[]) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px 0 24px;background-color:${COLOR.paper};border-radius:12px">
                ${details
                  .map(
                    ({ label, value }, index) => `
                <tr>
                  <td valign="top" style="padding:12px 0 12px 18px;${index > 0 ? `border-top:1px solid ${COLOR.border};` : ''}font-family:${FONT_BODY};font-size:13px;line-height:20px;color:${COLOR.muted}">${escapeHtml(label)}</td>
                  <td valign="top" align="right" style="padding:12px 18px 12px 12px;${index > 0 ? `border-top:1px solid ${COLOR.border};` : ''}font-family:${FONT_BODY};font-size:14px;line-height:20px;font-weight:700;color:${COLOR.ink}">${escapeHtml(value)}</td>
                </tr>`,
                  )
                  .join('')}
              </table>`;

const actionHtml = ({ label, url }: { label: string; url: string }) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px">
                <tr>
                  <td align="center" bgcolor="${COLOR.primary}" style="background-color:${COLOR.primary};border-radius:10px">
                    <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT_BODY};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(label)} &rarr;</a>
                  </td>
                </tr>
              </table>`;

const footer = () => `
          <tr>
            <td class="sc-px" style="padding:24px 40px 8px;font-family:${FONT_BODY};font-size:12px;line-height:18px;color:${COLOR.muted}" align="center">
              <div style="font-weight:700;color:${COLOR.ink2}">${escapeHtml(RECEIPT_ISSUER.name)}</div>
              <div>${escapeHtml(RECEIPT_ISSUER.address)}</div>
              <div>MST: ${escapeHtml(RECEIPT_ISSUER.taxCode)}</div>
              <div style="padding-top:12px">Email được gửi tự động, vui lòng không trả lời. Cần hỗ trợ? Mở mục <a href="${escapeHtml(`${appUrl}/support`)}" style="color:${COLOR.primary};font-weight:600;text-decoration:underline">Hỗ trợ</a> trong ứng dụng.</div>
            </td>
          </tr>`;

const renderHtml = (content: EmailContent) => `<!DOCTYPE html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${escapeHtml(content.subject)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;600;700&family=Barlow+Condensed:wght@800&display=swap" rel="stylesheet">
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; }
    a { color:${COLOR.primary}; }
    @media only screen and (max-width:620px) {
      .sc-outer { padding:12px 8px !important; }
      .sc-px { padding-left:22px !important; padding-right:22px !important; }
      .sc-title { font-size:26px !important; line-height:30px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLOR.paper};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.paper}">${escapeHtml(content.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${COLOR.paper}">
    <tr>
      <td class="sc-outer" align="center" style="padding:32px 16px">
        <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px">${header()}
          <tr>
            <td class="sc-px" style="background-color:${COLOR.surface};padding:36px 40px 16px;border:1px solid ${COLOR.borderSoft};border-top:0;border-radius:0 0 16px 16px;font-family:${FONT_BODY};color:${COLOR.ink2}">${content.eyebrow ? eyebrowHtml(content.eyebrow) : ''}
              <h1 class="sc-title" style="margin:0 0 20px;font-family:${FONT_DISPLAY};font-size:30px;line-height:34px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:${COLOR.ink}">${escapeHtml(content.title)}</h1>${
                content.greeting
                  ? `
              <p style="margin:0 0 14px;font-size:15px;line-height:24px">${escapeHtml(content.greeting)}</p>`
                  : ''
              }${content.paragraphs
                .map(
                  (paragraph) => `
              <p style="margin:0 0 18px;font-size:15px;line-height:24px">${paragraphHtml(paragraph)}</p>`,
                )
                .join(
                  '',
                )}${content.code ? codeHtml(content.code) : ''}${content.details?.length ? detailsHtml(content.details) : ''}${content.action ? actionHtml(content.action) : ''}${(
                content.notes ?? []
              )
                .map(
                  (note) => `
              <p style="margin:0 0 14px;font-size:13px;line-height:20px;color:${COLOR.muted};word-break:break-word">${escapeHtml(note)}</p>`,
                )
                .join('')}
              <p style="margin:24px 0 20px;padding-top:20px;border-top:1px solid ${COLOR.borderSoft};font-size:14px;line-height:22px;color:${COLOR.ink2}">Trân trọng,<br><strong style="color:${COLOR.ink}">Đội ngũ Sports Center</strong></p>
            </td>
          </tr>${footer()}
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

const renderText = (content: EmailContent) => {
  const blocks: string[] = [content.title.toUpperCase()];
  if (content.greeting) blocks.push(content.greeting);
  blocks.push(...content.paragraphs);
  if (content.code) blocks.push(`Mã xác nhận: ${content.code}`);
  if (content.details?.length) blocks.push(content.details.map(({ label, value }) => `${label}: ${value}`).join('\n'));
  if (content.action) blocks.push(`${content.action.label}: ${content.action.url}`);
  blocks.push(...(content.notes ?? []));
  blocks.push('Trân trọng,\nĐội ngũ Sports Center');
  blocks.push(
    [
      '--',
      RECEIPT_ISSUER.name,
      RECEIPT_ISSUER.address,
      `MST: ${RECEIPT_ISSUER.taxCode}`,
      'Email được gửi tự động, vui lòng không trả lời.',
    ].join('\n'),
  );
  return blocks.join('\n\n');
};

export const renderEmail = (content: EmailContent): RenderedEmail => ({
  subject: content.subject,
  text: renderText(content),
  html: renderHtml(content),
});
