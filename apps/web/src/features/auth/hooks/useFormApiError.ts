import { App } from 'antd';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { fieldErrorsToMap, toApiError, type ApiError } from '~/lib/http-errors';

const CODE_TO_FIELD: Record<string, string> = {
  EMAIL_TAKEN: 'email',
  EMAIL_NOT_FOUND: 'email',
  INVALID_CREDENTIALS: 'root',
  ACCOUNT_INACTIVE: 'root',
  OTP_INVALID: 'otp',
  OTP_EXPIRED: 'otp',
  OTP_MAX_ATTEMPTS: 'otp',
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
