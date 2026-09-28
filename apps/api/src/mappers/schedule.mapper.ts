import type { ScheduleConflict, SessionConflict } from '@sports-center/shared';

import type { UpcomingBooking, UpcomingSession } from '~/repositories/schedule.repository';
import { formatDate, formatTime, fromDbTime } from '~/utils/time';

export const toBookingConflict = (booking: UpcomingBooking): ScheduleConflict => ({
  id: booking.id,
  facility: booking.facility,
  date: formatDate(booking.bookingDate),
  startTime: formatTime(fromDbTime(booking.startTime)),
  endTime: formatTime(fromDbTime(booking.endTime)),
});

export const toSessionConflict = (session: UpcomingSession): SessionConflict => ({
  id: session.id,
  classId: session.class.id,
  className: session.class.name,
  facility: session.facility,
  date: formatDate(session.sessionDate),
  startTime: formatTime(fromDbTime(session.startTime)),
  endTime: formatTime(fromDbTime(session.endTime)),
});
