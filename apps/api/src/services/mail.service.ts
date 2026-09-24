import type { OtpPurpose } from '@sports-center/shared';

import { env } from '~/configs/env';
import { mailer } from '~/configs/mailer';
import { otpTemplate } from '~/templates/otp.template';
import { welcomeTemplate } from '~/templates/welcome.template';

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

    const { error } = await mailer.emails.send({ from: env.MAIL_FROM, ...options });
    if (error) throw new Error(`Failed to send mail: ${error.message}`);
  };

  sendOtp = (to: string, purpose: OtpPurpose, code: string) => this.send({ to, ...otpTemplate(purpose, code) });

  sendWelcome = (to: string, fullName: string) => this.send({ to, ...welcomeTemplate(fullName) });
}

export default new MailService();
