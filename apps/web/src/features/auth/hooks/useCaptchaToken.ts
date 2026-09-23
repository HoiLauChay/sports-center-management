import { useState } from 'react';
import { config } from '~/lib/config';

export const DEV_CAPTCHA_TOKEN = 'dev';

export function useCaptchaToken() {
  return useState<string | null>(config.turnstileSiteKey ? null : DEV_CAPTCHA_TOKEN);
}
