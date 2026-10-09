import { z } from 'zod';

import { ATTENDANCE_STATUSES } from '../constants/enums';

export const attendanceSessionParamsSchema = z.object({ id: z.uuid('Mã buổi học không hợp lệ') });

export const saveAttendanceBodySchema = z.object({
  records: z
    .array(
      z.object({
        accountId: z.uuid('Mã học viên không hợp lệ'),
        status: z.enum(ATTENDANCE_STATUSES, 'Trạng thái điểm danh không hợp lệ'),
        note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional(),
      }),
    )
    .min(1, 'Vui lòng chọn học viên')
    .refine((records) => new Set(records.map(({ accountId }) => accountId)).size === records.length, {
      message: 'Mỗi học viên chỉ được xuất hiện một lần',
    }),
});

export const myAttendanceQuerySchema = z.object({ classId: z.uuid('Mã lớp không hợp lệ').optional() });

export type SaveAttendanceBody = z.infer<typeof saveAttendanceBodySchema>;
export type MyAttendanceQuery = z.infer<typeof myAttendanceQuerySchema>;
