import { App } from 'antd';
import { useCallback } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { fieldErrorsToMap, toApiError, type ApiError } from '~/lib/http-errors';

/** Maps an API error `code` to the form field that should show it; `'root'` means a form-level error. */
export type ErrorFieldMap = Partial<Record<string, string>>;

export function useFormApiError<T extends FieldValues>(form: UseFormReturn<T>, codeToField: ErrorFieldMap = {}) {
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

      const target = codeToField[apiError.code];
      if (target === 'root') {
        form.setError('root', { message: apiError.message });
      } else if (target) {
        form.setError(target as Path<T>, { message: apiError.message });
      } else {
        message.error(apiError.message);
      }
      return apiError;
    },
    [form, message, codeToField],
  );
}
