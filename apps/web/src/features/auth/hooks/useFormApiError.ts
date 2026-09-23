import { ERROR_CODE } from '@sports-center/shared';
import { App } from 'antd';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { fieldErrorsToMap, toApiError, type ApiError } from '~/lib/http-errors';

const CODE_TO_FIELD: Record<string, string> = {
  [ERROR_CODE.EMAIL_TAKEN]: 'email',
  [ERROR_CODE.EMAIL_NOT_FOUND]: 'email',
  [ERROR_CODE.INVALID_CREDENTIALS]: 'root',
  [ERROR_CODE.ACCOUNT_INACTIVE]: 'root',
  [ERROR_CODE.OTP_INVALID]: 'otp',
  [ERROR_CODE.OTP_EXPIRED]: 'otp',
  [ERROR_CODE.OTP_MAX_ATTEMPTS]: 'otp',
};

export function useFormApiError<T extends FieldValues>(form: UseFormReturn<T>) {
  const { message } = App.useApp();

  return useCallback(
    (err: unknown): ApiError => {
      const apiError = toApiError(err);
      const fieldErrors = fieldErrorsToMap(apiError.errors);
      const fieldNames = Object.keys(fieldErrors);

      if (fieldNames.length > 0) {
        for (const name of fieldNames) {
          form.setError(name as Path<T>, { message: fieldErrors[name] });
        }
        return apiError;
      }

      const target = CODE_TO_FIELD[apiError.code];
      if (target === 'root') {
        form.setError('root', { message: apiError.message });
      } else if (target) {
        form.setError(target as Path<T>, { message: apiError.message });
      } else {
        message.error(apiError.message);
      }
      return apiError;
    },
    [form, message],
  );
}
