import type { Attendance, Person } from '@sports-center/shared';

import type { AttendanceRow } from '~/repositories/attendance.repository';

export const toAttendanceResponse = (account: Person, row?: AttendanceRow): Attendance => ({
  account,
  status: row?.status ?? null,
  note: row?.note ?? null,
  updatedBy: row?.updatedBy ?? null,
  updatedAt: row?.updatedAt.toISOString() ?? null,
});
