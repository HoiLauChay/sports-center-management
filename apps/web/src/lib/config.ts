export const config = {
  apiBaseUrl: '/api/v1',
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
