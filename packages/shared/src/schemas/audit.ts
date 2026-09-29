import { z } from 'zod';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../constants/enums';
import { cursorQuerySchema } from './pagination';

export const listAuditLogsQuerySchema = cursorQuerySchema
  .extend({
    from: z.iso.date('Ngày bắt đầu không hợp lệ'),
    to: z.iso.date('Ngày kết thúc không hợp lệ'),
    entityType: z.enum(AUDIT_ENTITY_TYPES, 'Loại đối tượng không hợp lệ').optional(),
    accountId: z.uuid('Mã người thao tác không hợp lệ').optional(),
    action: z.enum(AUDIT_ACTIONS, 'Hành động không hợp lệ').optional(),
  })
  .refine(({ from, to }) => from <= to, { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
