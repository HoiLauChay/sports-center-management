import type { ApiErrorBody, ApiFieldError, ScheduleConflict, SessionConflict } from '@sports-center/shared';
import axios from 'axios';
import { MockApiError } from './mock/errors';

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

export function toApiError(err: unknown, fallback = FALLBACK): ApiError {
  if (err instanceof MockApiError) {
    return { status: err.status, code: err.code, message: err.message, errors: err.errors };
  }
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

/** Extra payload an error response carries next to `code`/`message` (e.g. the fresh `quote` of a `PRICE_CHANGED`). */
export function errorPayload<T>(err: unknown, key: string): T | undefined {
  if (err instanceof MockApiError) return err.body[key] as T | undefined;
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

/** Upcoming bookings / class sessions the API returned alongside a 409 `SCHEDULE_CONFLICT` / `HAS_DEPENDENCIES`. */
export function scheduleConflictsOf(err: unknown): ScheduleConflicts | null {
  if (!axios.isAxiosError<Partial<ScheduleConflicts>>(err)) return null;
  const { bookings = [], sessions = [] } = err.response?.data ?? {};
  return bookings.length || sessions.length ? { bookings, sessions } : null;
}
