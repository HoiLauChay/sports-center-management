import { ERROR_CODE } from '@sports-center/shared';
import type { ErrorFieldMap } from '~/hooks/useFormApiError';

export const PROFILE_ERROR_FIELDS: ErrorFieldMap = {
  [ERROR_CODE.PHONE_TAKEN]: 'phone',
};
