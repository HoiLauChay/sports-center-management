import type { ErrorCode } from '@sports-center/shared';

export class ErrorWithStatus extends Error {
  status: number;
  code: ErrorCode;
  errors?: unknown;
  meta?: Record<string, unknown>;

  constructor({
    message,
    status,
    code,
    errors,
    meta,
  }: {
    message: string;
    status: number;
    code: ErrorCode;
    errors?: unknown;
    meta?: Record<string, unknown>;
  }) {
    super(message);
    this.status = status;
    this.code = code;
    if (errors !== undefined) this.errors = errors;
    if (meta !== undefined) this.meta = meta;
  }
}
