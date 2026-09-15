import axios from 'axios';
import type { ApiErrorBody, ApiFieldError } from '~/types/api';

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

export function fieldErrorsToMap(errors: ApiFieldError[] | undefined) {
  const map: Record<string, string> = {};
  for (const e of errors ?? []) {
    const key = e.path.replace(/^body\./, '');
    if (!(key in map)) map[key] = e.message;
  }
  return map;
}
