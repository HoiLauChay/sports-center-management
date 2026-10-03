import { z } from 'zod';

import { ORDER_STATUSES } from '../constants/enums';
import { phoneSchema } from './account';
import { pageQuerySchema } from './pagination';

const dateRange = {
  from: z.iso.date('Ngày bắt đầu không hợp lệ').optional(),
  to: z.iso.date('Ngày kết thúc không hợp lệ').optional(),
};

const validRange = ({ from, to }: { from?: string; to?: string }) => !from || !to || from <= to;
const rangeIssue = { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' };

export const listMyOrdersQuerySchema = pageQuerySchema.extend(dateRange).refine(validRange, rangeIssue);

export const listOrdersQuerySchema = pageQuerySchema
  .extend({
    ...dateRange,
    accountId: z.uuid('Mã thành viên không hợp lệ').optional(),
    guestPhone: phoneSchema.optional(),
    status: z.enum(ORDER_STATUSES, 'Trạng thái không hợp lệ').optional(),
    orderNumber: z.string().trim().toUpperCase().min(1).max(50).optional(),
  })
  .refine(validRange, rangeIssue);

export const orderIdParamsSchema = z.object({ id: z.uuid('Mã đơn không hợp lệ') });

export const refundReceiptParamsSchema = orderIdParamsSchema.extend({
  transactionId: z.uuid('Mã giao dịch không hợp lệ'),
});

export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
