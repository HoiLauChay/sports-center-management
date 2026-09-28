import type { Ref } from './api';

export interface SystemSettings {
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  maxAdvanceBookingDays: number;
  bookingCancelDeadlineHours: number;
  courseCancelDeadlineDays: number;
  membershipExpiryWarningDays: number;
  topUpMinAmount: number;
  topUpExpiryMinutes: number;
}

export interface ScheduleConflict {
  id: string;
  facility: Ref;
  date: string;
  startTime: string;
  endTime: string;
}

export interface SessionConflict extends ScheduleConflict {
  classId: string;
  className: string;
}
