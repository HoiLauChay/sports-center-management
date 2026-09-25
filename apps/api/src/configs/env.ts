import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(8000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    TOKEN_HASH_SECRET: z.string().min(32),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().min(1).default('Sports Center <onboarding@resend.dev>'),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    UPSTASH_REDIS_REST_URL: z.url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;
    for (const key of [
      'RESEND_API_KEY',
      'TURNSTILE_SECRET_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ] as const) {
      if (!value[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production' });
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
