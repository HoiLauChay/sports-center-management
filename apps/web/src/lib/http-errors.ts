import type { ApiErrorBody, ApiFieldError, ScheduleConflict, SessionConflict } from '@sports-center/shared';
import axios from 'axios';

export const CLIENT_ERROR_CODE = {
  NETWORK: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  UNKNOWN: 'UNKNOWN',
} as const;

export interface ApiError {
  status?: number;
  code: string;
  message: string;
  errors?: ApiFieldError[];
  retryAfter?: number;
}

const FALLBACK = 'Có lỗi xảy ra, vui lòng thử lại.';

export class ApiRequestError extends Error {
  readonly detail: ApiError;

  constructor(detail: ApiError) {
    super(detail.message);
    this.detail = detail;
  }
}

export function toApiError(err: unknown, fallback = FALLBACK): ApiError {
  if (err instanceof ApiRequestError) return err.detail;
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    if (err.response) {
      const body = err.response.data;
      return {
        status: err.response.status,
        code: body?.code ?? CLIENT_ERROR_CODE.UNKNOWN,
        message: body?.message ?? fallback,
        errors: body?.errors,
        retryAfter: body?.retryAfter,
      };
    }
    if (err.code === 'ECONNABORTED') {
      return { code: CLIENT_ERROR_CODE.TIMEOUT, message: 'Yêu cầu quá thời gian, vui lòng thử lại.' };
    }
    return { code: CLIENT_ERROR_CODE.NETWORK, message: 'Không kết nối được máy chủ, kiểm tra mạng của bạn.' };
  }
  return { code: CLIENT_ERROR_CODE.UNKNOWN, message: err instanceof Error ? err.message : fallback };
}

export function describeApiError(err: unknown, fallback?: string): string {
  const apiError = toApiError(err, fallback);
  return apiError.errors?.[0]?.message ?? apiError.message;
}

export function errorPayload<T>(err: unknown, key: string): T | undefined {
  if (axios.isAxiosError<Record<string, unknown>>(err)) return err.response?.data?.[key] as T | undefined;
  return undefined;
}

export function fieldErrorsToMap(errors: ApiFieldError[] | undefined) {
  const map: Record<string, string> = {};
  for (const e of errors ?? []) {
    const key = e.path.replace(/^body\./, '');
    if (!(key in map)) map[key] = e.message;
  }
  return map;
}

export interface ScheduleConflicts {
  bookings: ScheduleConflict[];
  sessions: SessionConflict[];
}

export function scheduleConflictsOf(err: unknown): ScheduleConflicts | null {
  if (!axios.isAxiosError<Partial<ScheduleConflicts>>(err)) return null;
  const { bookings = [], sessions = [] } = err.response?.data ?? {};
  return bookings.length || sessions.length ? { bookings, sessions } : null;
}
