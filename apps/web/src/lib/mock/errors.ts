import type { ApiFieldError } from '@sports-center/shared';

/**
 * Error thrown by mock services (endpoints the backend has not shipped yet). It mirrors the failure body
 * documented in `api.design.md`, so `toApiError` treats it exactly like an Axios error from the real API.
 */
export class MockApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly errors?: ApiFieldError[];
  readonly body: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { errors?: ApiFieldError[]; body?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'MockApiError';
    this.status = status;
    this.code = code;
    this.errors = options.errors;
    this.body = options.body ?? {};
  }
}

export const mockErrors = {
  notFound: (message = 'Không tìm thấy dữ liệu') => new MockApiError(404, 'NOT_FOUND', message),
  conflict: (code: string, message: string, body?: Record<string, unknown>) =>
    new MockApiError(409, code, message, { body }),
  invalid: (path: string, message: string) =>
    new MockApiError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { errors: [{ path, message }] }),
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs a mock handler after a short latency so loading states behave like real requests. */
export async function mockRequest<T>(handler: () => T | Promise<T>, latency = 220): Promise<T> {
  await sleep(latency + Math.random() * 120);
  return handler();
}
