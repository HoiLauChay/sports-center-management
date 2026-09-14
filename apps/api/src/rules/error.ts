import type { ErrorCode } from '~/constants/errorCode';

export class ErrorWithStatus extends Error {
  status: number;
  code: ErrorCode;
  errors?: unknown;

  constructor({
    message,
    status,
    code,
    errors,
  }: {
    message: string;
    status: number;
    code: ErrorCode;
    errors?: unknown;
  }) {
    super(message);
    this.status = status;
    this.code = code;
    if (errors !== undefined) this.errors = errors;
  }
}
