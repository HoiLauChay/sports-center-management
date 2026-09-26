import { z } from 'zod';

import { PAGINATION } from '../constants/pagination';

const { DEFAULT_LIMIT, MAX_LIMIT } = PAGINATION;

export const limitSchema = z.coerce
  .number('Số lượng phải là số')
  .int('Số lượng phải là số nguyên')
  .min(1, 'Số lượng tối thiểu là 1')
  .max(MAX_LIMIT, `Số lượng tối đa là ${MAX_LIMIT}`)
  .default(DEFAULT_LIMIT);

export const pageQuerySchema = z.object({
  page: z.coerce.number('Trang phải là số').int('Trang phải là số nguyên').min(1, 'Trang tối thiểu là 1').default(1),
  limit: limitSchema,
});

export const cursorQuerySchema = z.object({
  cursor: z.uuid('Cursor không hợp lệ').optional(),
  limit: limitSchema,
});

export type PageQuery = z.infer<typeof pageQuerySchema>;
export type CursorQuery = z.infer<typeof cursorQuerySchema>;
