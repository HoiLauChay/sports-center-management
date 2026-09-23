import { env, isProduction } from '~/configs/env';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

let warnedMissingKey = false;

export const verifyCaptcha = async (token: string, ip?: string): Promise<boolean> => {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (isProduction) return false;
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn('TURNSTILE_SECRET_KEY is not set, captcha verification is skipped in development');
    }
    return true;
  }

  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
  });

  if (!res.ok) return false;

  const data = (await res.json()) as { success: boolean };
  return data.success;
};
