import { z } from 'zod';

import { cursorQuerySchema } from './pagination';

export const listNotificationsQuerySchema = cursorQuerySchema.extend({
  unreadOnly: z.stringbool('Bộ lọc chưa đọc không hợp lệ').optional(),
});

export const notificationIdParamsSchema = z.object({ id: z.uuid('Mã thông báo không hợp lệ') });

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
