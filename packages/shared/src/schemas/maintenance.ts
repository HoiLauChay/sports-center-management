import { z } from 'zod';

import { timeOfDaySchema } from './time';

const dateTimeSchema = z.iso.datetime({ offset: true, message: 'Thời điểm không hợp lệ' });

const periodFields = {
  startAt: dateTimeSchema,
  endAt: dateTimeSchema,
  reason: z.string('Vui lòng nhập lý do').trim().min(1, 'Vui lòng nhập lý do').max(500, 'Lý do tối đa 500 ký tự'),
};

const facilityField = { facilityId: z.uuid('Mã cơ sở không hợp lệ') };

const resolutionFields = {
  bookingMoves: z
    .array(z.object({ bookingId: z.uuid('Mã booking không hợp lệ'), facilityId: z.uuid('Mã cơ sở không hợp lệ') }))
    .default([]),
  sessionResolutions: z
    .array(
      z.discriminatedUnion(
        'action',
        [
          z.object({
            sessionId: z.uuid('Mã buổi học không hợp lệ'),
            action: z.literal('MOVE_FACILITY'),
            facilityId: z.uuid('Mã cơ sở không hợp lệ'),
          }),
          z.object({
            sessionId: z.uuid('Mã buổi học không hợp lệ'),
            action: z.literal('RESCHEDULE'),
            date: z.iso.date('Ngày học không hợp lệ'),
            startTime: timeOfDaySchema,
            endTime: timeOfDaySchema,
            facilityId: z.uuid('Mã cơ sở không hợp lệ').optional(),
          }),
        ],
        'Cách xử lý buổi học không hợp lệ',
      ),
    )
    .default([]),
};

const endsAfterStart = ({ startAt, endAt }: { startAt: string; endAt: string }) =>
  Date.parse(startAt) < Date.parse(endAt);
const endAfterStartIssue = { path: ['endAt'], message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu' };

export const maintenanceWindowSchema = z
  .object({ ...facilityField, ...periodFields })
  .refine(endsAfterStart, endAfterStartIssue);

export const createMaintenanceBodySchema = z
  .object({ ...facilityField, ...periodFields, ...resolutionFields })
  .refine(endsAfterStart, endAfterStartIssue);

export const updateMaintenanceBodySchema = z
  .object({ ...periodFields, ...resolutionFields })
  .refine(endsAfterStart, endAfterStartIssue);

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
export type CreateMaintenanceBody = z.infer<typeof createMaintenanceBodySchema>;
export type UpdateMaintenanceBody = z.infer<typeof updateMaintenanceBodySchema>;
export type ListMaintenancesQuery = z.infer<typeof listMaintenancesQuerySchema>;
