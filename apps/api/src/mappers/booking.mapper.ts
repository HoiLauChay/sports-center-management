import type { Booking, FacilityPackage } from '@sports-center/shared';

import type { BookingRow, FacilityPackageRow } from '~/repositories/booking.repository';
import { formatDate, formatTime, fromDbTime } from '~/utils/time';

export const toBookingResponse = (row: BookingRow): Booking => ({
  id: row.id,
  facility: row.facility,
  date: formatDate(row.bookingDate),
  startTime: formatTime(fromDbTime(row.startTime)),
  endTime: formatTime(fromDbTime(row.endTime)),
  status: row.status,
  unitPrice: Number(row.unitPrice),
  benefit: row.benefit,
  paidAmount: row.packageId ? null : Number(row.orderItem.totalAmount),
  packageId: row.packageId,
  orderItemId: row.orderItemId,
  account: row.account,
  guestName: row.orderItem.order.guestName,
  guestPhone: row.orderItem.order.guestPhone,
  createdAt: row.createdAt.toISOString(),
});

export const toFacilityPackageResponse = (row: FacilityPackageRow): FacilityPackage => ({
  id: row.id,
  facility: row.facility,
  startDate: formatDate(row.startDate),
  endDate: formatDate(row.endDate),
  daysOfWeek: row.daysOfWeek,
  startTime: formatTime(fromDbTime(row.startTime)),
  endTime: formatTime(fromDbTime(row.endTime)),
  status: row.status,
  unitPrice: Number(row.unitPrice),
  bookings: row.bookings.map(toBookingResponse),
});
