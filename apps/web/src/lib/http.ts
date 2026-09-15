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
  withCredentials: true,
  timeout: 15_000,
});

export const privateApi = axios.create({
  baseURL: config.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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
      onAuthRefreshFailed?.();
      return Promise.reject(refreshError);
    }

    return privateApi(originalRequest);
  },
);
