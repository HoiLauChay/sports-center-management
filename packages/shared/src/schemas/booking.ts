import { z } from 'zod';

import { phoneSchema } from './account';
import { pageQuerySchema } from './pagination';

const bookingQuery = pageQuerySchema.extend({
  from: z.iso.date('Ngày bắt đầu không hợp lệ').optional(),
  to: z.iso.date('Ngày kết thúc không hợp lệ').optional(),
  status: z.enum(['CONFIRMED', 'CANCELLED'], 'Trạng thái không hợp lệ').optional(),
});
const validRange = ({ from, to }: { from?: string; to?: string }) => !from || !to || from <= to;
const rangeIssue = { path: ['to'], message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi' };

export const listMyBookingsQuerySchema = bookingQuery.refine(validRange, rangeIssue);
export const listBookingsQuerySchema = bookingQuery
  .extend({
    facilityId: z.uuid('Mã sân/phòng không hợp lệ').optional(),
    accountId: z.uuid('Mã thành viên không hợp lệ').optional(),
    guestPhone: phoneSchema.optional(),
    date: z.iso.date('Ngày không hợp lệ').optional(),
  })
  .refine(validRange, rangeIssue);
export const bookingIdParamsSchema = z.object({ id: z.uuid('Mã booking không hợp lệ') });

export type ListMyBookingsQuery = z.infer<typeof listMyBookingsQuerySchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
