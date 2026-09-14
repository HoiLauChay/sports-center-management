import { env } from '~/configs/env';
import { mailer } from '~/configs/mailer';
import type { OtpPurpose } from '~/generated/prisma/client';
import { otpTemplate } from '~/templates/otp.template';

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

class MailService {
  send = async (options: MailOptions) => {
    if (!mailer) {
      console.warn(`[mail:dev] to=${options.to} subject=${options.subject}\n${options.text}`);
      return;
    }

    await mailer.sendMail({ from: env.MAIL_FROM ?? env.SMTP_USER, ...options });
  };

  sendOtp = (to: string, purpose: OtpPurpose, code: string) => this.send({ to, ...otpTemplate(purpose, code) });
}

export default new MailService();
