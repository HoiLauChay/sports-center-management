import type { Ref } from './api';
import type { Person } from './audit';

export interface Maintenance {
  id: string;
  facility: Ref;
  startAt: string;
  endAt: string;
  reason: string;
  createdAt: string;
}

export interface MaintenanceAffectedBooking {
  id: string;
  account: Person | null;
  guestName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  packageId: string | null;
  alternatives: Ref[];
}

export interface MaintenanceAffectedSession {
  id: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  alternatives: Ref[];
}

export interface MaintenancePreview {
  affectedBookings: MaintenanceAffectedBooking[];
  affectedSessions: MaintenanceAffectedSession[];
}

export interface MaintenanceResult {
  maintenance: Maintenance;
  movedBookings: number;
  sessionsUpdated: number;
}
