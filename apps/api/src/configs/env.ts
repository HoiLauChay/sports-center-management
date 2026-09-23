import 'dotenv/config';
import { z } from 'zod';

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CLIENT_URL: z.url(),
    SMTP_HOST: z.string().default('smtp.gmail.com'),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    for (const key of ['SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'TURNSTILE_SECRET_KEY'] as const) {
      if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
