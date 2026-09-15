export interface ApiResponse<T = undefined> {
  status: true;
  message: string;
  result: T;
}

export interface ApiFieldError {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  status: false;
  code: string;
  message: string;
  errors?: ApiFieldError[];
  retryAfter?: number;
}
