import axios, { type InternalAxiosRequestConfig } from 'axios';
import { config } from './config';

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

let onAuthRefreshFailed: (() => void) | null = null;

export function configureHttpAuthRefreshFailed(fn: () => void) {
  onAuthRefreshFailed = fn;
}

export const publicApi = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

export const privateApi = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

let pendingRefresh: Promise<void> | null = null;

function refreshOnce(): Promise<void> {
  if (!pendingRefresh) {
    pendingRefresh = publicApi
      .post('/auth/refresh')
      .then(() => undefined)
      .finally(() => {
        pendingRefresh = null;
      });
  }
  return pendingRefresh;
}

/** The session is over only when the server refuses the refresh token; a network error or a 5xx is worth a retry. */
function notifyIfSessionEnded(refreshError: unknown) {
  const status = axios.isAxiosError(refreshError) ? refreshError.response?.status : undefined;
  if (status === 401 || status === 403) onAuthRefreshFailed?.();
}

export async function refreshSession() {
  try {
    await refreshOnce();
  } catch (refreshError) {
    notifyIfSessionEnded(refreshError);
    throw refreshError;
  }
}

privateApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableRequest | undefined;

    if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      await refreshOnce();
    } catch (refreshError) {
      notifyIfSessionEnded(refreshError);
      return Promise.reject(refreshError);
    }

    return privateApi(originalRequest);
  },
);
