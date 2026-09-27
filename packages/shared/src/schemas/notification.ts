import { z } from 'zod';

import { cursorQuerySchema } from './pagination';

export const listNotificationsQuerySchema = cursorQuerySchema.extend({
  unreadOnly: z.stringbool('Bộ lọc chưa đọc không hợp lệ').optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
