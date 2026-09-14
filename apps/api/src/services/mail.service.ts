import { env } from '~/configs/env';
import { mailer } from '~/configs/mailer';

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
}

export default new MailService();
