export interface ScheduleFacilityRef {
  id: string;
  name: string;
}

export interface SchedulePersonRef {
  id: string;
  fullName: string;
}

export interface ScheduleItemBase {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  facility: ScheduleFacilityRef;
}

export interface MemberBookingScheduleItem extends ScheduleItemBase {
  kind: 'BOOKING';
  status: 'CONFIRMED' | 'CANCELLED';
}

export interface MemberClassScheduleItem extends ScheduleItemBase {
  kind: 'CLASS_SESSION';
  class: { id: string; name: string; coach: SchedulePersonRef | null };
  status: 'SCHEDULED' | 'CANCELLED';
}

export type MemberScheduleItem = MemberBookingScheduleItem | MemberClassScheduleItem;

export interface CoachScheduleItem extends ScheduleItemBase {
  classId: string;
  sessionNumber: number;
  status: 'SCHEDULED' | 'CANCELLED';
  cancelReason: string | null;
  class: ScheduleFacilityRef;
}
