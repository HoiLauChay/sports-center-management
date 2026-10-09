import type { Maintenance, MaintenanceAffectedBooking, MaintenanceAffectedSession, Ref } from '@sports-center/shared';

import type { AffectedBookingRow, AffectedSessionRow, MaintenanceRow } from '~/repositories/maintenance.repository';
import { formatDate, formatTime, fromDbTime } from '~/utils/time';

const times = (row: { startTime: Date; endTime: Date }) => ({
  startTime: formatTime(fromDbTime(row.startTime)),
  endTime: formatTime(fromDbTime(row.endTime)),
});

export const toMaintenanceResponse = (row: MaintenanceRow): Maintenance => ({
  id: row.id,
  facility: row.facility,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
  reason: row.reason,
  createdAt: row.createdAt.toISOString(),
});

export const toAffectedBookingResponse = (
  row: AffectedBookingRow,
  alternatives: Ref[],
): MaintenanceAffectedBooking => ({
  id: row.id,
  account: row.account,
  guestName: row.orderItem.order.guestName,
  date: formatDate(row.bookingDate),
  ...times(row),
  packageId: row.packageId,
  alternatives,
});

export const toAffectedSessionResponse = (
  row: AffectedSessionRow,
  alternatives: Ref[],
): MaintenanceAffectedSession => ({
  id: row.id,
  classId: row.classId,
  className: row.class.name,
  date: formatDate(row.sessionDate),
  ...times(row),
  alternatives,
});
