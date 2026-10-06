import type { ClassDetail, ClassSession, ClassSummary, WeeklySlot } from '@sports-center/shared';

import { toCourseResponse } from '~/mappers/course.mapper';
import type { ClassDetailRow, ClassSessionRow, ClassSummaryRow } from '~/repositories/class.repository';
import { formatDate, formatTime, fromDbTime, todayInCenter } from '~/utils/time';

const derivedStatus = (row: ClassSummaryRow, today: string): ClassDetail['derivedStatus'] => {
  if (row.status !== 'OPEN' || !row.startDate || !row.endDate) return null;
  if (today < formatDate(row.startDate)) return 'UPCOMING';
  return today > formatDate(row.endDate) ? 'COMPLETED' : 'ONGOING';
};

export const toSessionResponse = (row: ClassSessionRow): ClassSession => ({
  id: row.id,
  classId: row.classId,
  sessionNumber: row.sessionNumber,
  date: formatDate(row.sessionDate),
  startTime: formatTime(fromDbTime(row.startTime)),
  endTime: formatTime(fromDbTime(row.endTime)),
  facility: row.facility,
  status: row.status,
  cancelReason: row.cancelReason,
});

export const toClassSummaryResponse = (row: ClassSummaryRow, now = new Date()): ClassSummary => ({
  id: row.id,
  name: row.name,
  course: toCourseResponse(row.course),
  status: row.status,
  derivedStatus: derivedStatus(row, todayInCenter(now)),
  startDate: row.startDate ? formatDate(row.startDate) : null,
  endDate: row.endDate ? formatDate(row.endDate) : null,
  weeklySchedule: row.weeklySchedule as unknown as WeeklySlot[],
  facility: row.facility,
  coach: row.coach,
  minStudents: row.minStudents,
  maxStudents: row.maxStudents,
  enrolledCount: row._count.enrollments,
  minStudentsOverride: row.minStudentsOverride,
  cancelReason: row.cancelReason,
});

export const toClassDetailResponse = (row: ClassDetailRow, now = new Date()): ClassDetail => ({
  ...toClassSummaryResponse(row, now),
  sessions: row.sessions.map(toSessionResponse),
});
