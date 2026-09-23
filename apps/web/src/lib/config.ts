export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  turnstileSiteKey: import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
};
