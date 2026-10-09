import type { BookingStatus } from '../constants/enums';
import type { Ref } from './api';
import type { Person } from './audit';
import type { ClassSession } from './class';

interface ScheduleItemBase {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  facility: Ref;
}

export interface MemberBookingScheduleItem extends ScheduleItemBase {
  kind: 'BOOKING';
  status: BookingStatus;
}

export interface MemberClassScheduleItem extends ScheduleItemBase {
  kind: 'CLASS_SESSION';
  class: Ref & { coach: Person | null };
  status: ClassSession['status'];
}

export type MemberScheduleItem = MemberBookingScheduleItem | MemberClassScheduleItem;

export interface CoachScheduleItem extends ClassSession {
  class: Ref;
}
