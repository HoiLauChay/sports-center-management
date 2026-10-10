import type { AttendanceStatus } from '@sports-center/shared';

/** The order the coach marks students in: most students are present. */
export const ATTENDANCE_ORDER: AttendanceStatus[] = ['PRESENT', 'LATE', 'ABSENT'];

export const ATTENDANCE_TAG: Record<AttendanceStatus, { label: string; color?: string }> = {
  PRESENT: { label: 'Có mặt', color: 'success' },
  LATE: { label: 'Muộn', color: 'warning' },
  ABSENT: { label: 'Vắng', color: 'error' },
};
