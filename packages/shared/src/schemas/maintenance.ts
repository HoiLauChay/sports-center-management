import { z } from 'zod';

const dateTimeSchema = z.iso.datetime({ offset: true, message: 'Thời điểm không hợp lệ' });

export const maintenanceWindowSchema = z
  .object({
    facilityId: z.uuid('Mã cơ sở không hợp lệ'),
    startAt: dateTimeSchema,
    endAt: dateTimeSchema,
    reason: z.string('Vui lòng nhập lý do').trim().min(1, 'Vui lòng nhập lý do').max(500, 'Lý do tối đa 500 ký tự'),
  })
  .refine(({ startAt, endAt }) => Date.parse(startAt) < Date.parse(endAt), {
    path: ['endAt'],
    message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu',
  });

export const listMaintenancesQuerySchema = z
  .object({
    facilityId: z.uuid('Mã cơ sở không hợp lệ').optional(),
    from: z.iso.date('Ngày bắt đầu không hợp lệ').optional(),
    to: z.iso.date('Ngày kết thúc không hợp lệ').optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    path: ['to'],
    message: 'Ngày kết thúc phải sau ngày bắt đầu',
  });

export const maintenanceIdParamsSchema = z.object({ id: z.uuid('Mã lịch bảo trì không hợp lệ') });

export type MaintenanceWindow = z.infer<typeof maintenanceWindowSchema>;
export type ListMaintenancesQuery = z.infer<typeof listMaintenancesQuerySchema>;
