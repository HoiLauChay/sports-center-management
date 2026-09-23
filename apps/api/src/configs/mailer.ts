import { Resend } from 'resend';

import { env } from '~/configs/env';

export const mailer = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
