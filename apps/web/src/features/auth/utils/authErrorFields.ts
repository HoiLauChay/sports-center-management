import { ERROR_CODE } from '@sports-center/shared';
import type { ErrorFieldMap } from '~/hooks/useFormApiError';

export const AUTH_ERROR_FIELDS: ErrorFieldMap = {
  [ERROR_CODE.EMAIL_TAKEN]: 'email',
  [ERROR_CODE.EMAIL_NOT_FOUND]: 'email',
  [ERROR_CODE.INVALID_CREDENTIALS]: 'root',
  [ERROR_CODE.ACCOUNT_INACTIVE]: 'root',
  [ERROR_CODE.OTP_INVALID]: 'otp',
  [ERROR_CODE.OTP_EXPIRED]: 'otp',
  [ERROR_CODE.OTP_MAX_ATTEMPTS]: 'otp',
};
