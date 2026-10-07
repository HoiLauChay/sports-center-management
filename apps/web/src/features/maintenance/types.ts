import type { Person, Ref } from '@sports-center/shared';

export interface Maintenance {
  id: string;
  facility: Ref;
  startAt: string;
  endAt: string;
  reason: string;
  createdAt: string;
  /** Who scheduled it (shown in the list; not part of the documented response yet). */
  createdBy?: Person | null;
}

export type MaintenancePhase = 'PLANNED' | 'ONGOING' | 'DONE';

export interface MaintenanceRequest {
  facilityId: string;
  startAt: string;
  endAt: string;
  reason: string;
}

export interface AffectedBooking {
  id: string;
  account: Person | null;
  guestName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  packageId: string | null;
  /** Facilities of the same sport with room at exactly that time. */
  alternatives: Ref[];
}

export interface AffectedSession {
  id: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  /** Facilities of the same sport that are free at exactly that time. */
  alternatives: Ref[];
}

/** `POST /maintenances/preview`: what a maintenance window would hit, without writing anything. */
export interface MaintenancePreview {
  affectedBookings: AffectedBooking[];
  affectedSessions: AffectedSession[];
}

export type SessionResolution =
  | { sessionId: string; action: 'MOVE_FACILITY'; facilityId: string }
  | {
      sessionId: string;
      action: 'RESCHEDULE';
      date: string;
      startTime: string;
      endTime: string;
      facilityId?: string;
    };

export interface BookingMove {
  bookingId: string;
  facilityId: string;
}

export interface CreateMaintenanceBody extends MaintenanceRequest {
  bookingMoves: BookingMove[];
  sessionResolutions: SessionResolution[];
}

export interface CreateMaintenanceResult {
  maintenance: Maintenance;
  movedBookings: number;
  sessionsUpdated: number;
}

/** A booking that has nowhere to move (`bookings` of a 409 `MAINTENANCE_BLOCKED`). */
export interface BlockedBooking {
  bookingId: string;
  who: string;
  date: string;
  startTime: string;
  endTime: string;
}

/** A session whose resolution cannot be applied (`sessions` of a 409 `MAINTENANCE_BLOCKED`). */
export interface BlockedSession {
  sessionId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  reason: string;
}

export interface ListMaintenancesQuery {
  facilityId?: string;
  from?: string;
  to?: string;
}
