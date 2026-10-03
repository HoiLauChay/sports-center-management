import type { ScheduleClashReason } from '../constants/enums';

export interface ScheduleClash {
  date: string;
  startTime: string;
  endTime: string;
  reason: ScheduleClashReason;
  bookingId?: string;
  classSession?: { id: string; classId: string; className: string };
  maintenance?: { id: string; reason: string };
}
