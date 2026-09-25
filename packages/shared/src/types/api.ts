import type { ErrorCode } from '../constants/errorCode';

export interface ApiResponse<T = undefined> {
  status: true;
  message: string;
  result: T;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  status: false;
  code: ErrorCode;
  message: string;
  errors?: ApiFieldError[];
  retryAfter?: number;
}
