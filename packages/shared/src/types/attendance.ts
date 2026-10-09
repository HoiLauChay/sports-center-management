import type { AttendanceStatus } from '../constants/enums';
import type { Person } from './audit';
import type { ClassSession } from './class';

export interface Attendance {
  account: Person;
  status: AttendanceStatus | null;
  note: string | null;
  updatedBy: Person | null;
  updatedAt: string | null;
}

export interface MyAttendance {
  session: ClassSession;
  status: AttendanceStatus | null;
  note: string | null;
}
