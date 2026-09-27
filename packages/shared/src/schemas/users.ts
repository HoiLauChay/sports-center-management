import { z } from 'zod';

import { ACCOUNT_STATUSES, ROLES } from '../constants/enums';
import { pageQuerySchema } from './pagination';

export const listUsersQuerySchema = pageQuerySchema.safeExtend({
  q: z.string().trim().max(255).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(ACCOUNT_STATUSES).optional(),
});

export const userIdParamsSchema = z.object({ id: z.uuid() });

export type ListUsersQueryParsed = z.infer<typeof listUsersQuerySchema>;
