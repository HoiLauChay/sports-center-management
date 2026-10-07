import type { Facility, Ref } from '@sports-center/shared';
import { moveBookingForMaintenance } from '~/features/bookings/mocks/bookings';
import type { Actor } from '~/features/checkout/mocks/pricing';
import { updateSession } from '~/features/classes/mocks/classAdmin';
import { classesDb, classesStore } from '~/features/classes/mocks/classes';
import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { createMockStore, newId, nowIso } from '~/lib/mock/store';
import { isPast, nowVN, toMinutes } from '~/lib/time';
import type {
  AffectedBooking,
  AffectedSession,
  BlockedBooking,
  BlockedSession,
  CreateMaintenanceBody,
  CreateMaintenanceResult,
  ListMaintenancesQuery,
  Maintenance,
  MaintenancePreview,
  MaintenanceRequest,
  SessionResolution,
} from '../types';
import { localOf, MINUTE_FORMAT, phaseOf } from '../utils';

const store = createMockStore<{ items: Maintenance[] }>('sc_mock_maintenance_v1', () => ({ items: [] }));

/** True when a slot (`date` + times, business timezone) overlaps the maintenance window. */
const hits = (window: { startAt: string; endAt: string }, date: string, startTime: string, endTime: string) =>
  localOf(window.startAt) < `${date} ${endTime}` && `${date} ${startTime}` < localOf(window.endAt);

export function listMaintenances(query: ListMaintenancesQuery): Maintenance[] {
  return store
    .get()
    .items.filter((item) => {
      if (query.facilityId && item.facility.id !== query.facilityId) return false;
      if (query.from && localOf(item.endAt).slice(0, 10) < query.from) return false;
      if (query.to && localOf(item.startAt).slice(0, 10) > query.to) return false;
      return true;
    })
    .sort((a, b) => b.startAt.localeCompare(a.startAt));
}

/** Is a facility free at exactly this time: no class session, no booking and no other maintenance (BR_2.3). */
function freeAt(facilityId: string, date: string, startTime: string, endTime: string, ignoreSessionId?: string) {
  const sessionClash = classesDb
    .sessionsAt(facilityId, date)
    .some(
      (entry) =>
        entry.session.id !== ignoreSessionId && startTime < entry.session.endTime && entry.session.startTime < endTime,
    );
  if (sessionClash) return false;
  const bookingClash = commerceStore
    .get()
    .bookings.some(
      (entry) =>
        entry.status === 'CONFIRMED' &&
        entry.facility.id === facilityId &&
        entry.date === date &&
        startTime < entry.endTime &&
        entry.startTime < endTime,
    );
  if (bookingClash) return false;
  return !store.get().items.some((item) => item.facility.id === facilityId && hits(item, date, startTime, endTime));
}

/** Can one more booking fit: no class session, no maintenance and fewer bookings than the capacity (BR_2.1, BR_2.3). */
function roomAt(facility: Facility, date: string, startTime: string, endTime: string, extra = 0) {
  const overlapping = (entry: { date: string; startTime: string; endTime: string }) =>
    entry.date === date && startTime < entry.endTime && entry.startTime < endTime;
  if (classesDb.sessionsAt(facility.id, date).some((entry) => overlapping(entry.session))) return false;
  if (store.get().items.some((item) => item.facility.id === facility.id && hits(item, date, startTime, endTime))) {
    return false;
  }
  const booked = commerceStore
    .get()
    .bookings.filter(
      (entry) => entry.status === 'CONFIRMED' && entry.facility.id === facility.id && overlapping(entry),
    ).length;
  return booked + extra < facility.capacityPerSlot;
}

function validateWindow(request: MaintenanceRequest, facilities: Facility[]) {
  const facility = facilities.find((entry) => entry.id === request.facilityId);
  if (!facility) throw mockErrors.invalid('body.facilityId', 'Vui lòng chọn sân / phòng');
  if (!request.reason.trim()) throw mockErrors.invalid('body.reason', 'Vui lòng nhập lý do bảo trì');
  if (localOf(request.startAt) >= localOf(request.endAt)) {
    throw mockErrors.invalid('body.endAt', 'Thời điểm kết thúc phải sau thời điểm bắt đầu');
  }
  if (localOf(request.endAt) <= nowVN().format(MINUTE_FORMAT)) {
    throw mockErrors.invalid('body.endAt', 'Khoảng bảo trì đã qua');
  }
  const overlapping = store
    .get()
    .items.find(
      (item) =>
        item.facility.id === facility.id &&
        localOf(item.startAt) < localOf(request.endAt) &&
        localOf(request.startAt) < localOf(item.endAt),
    );
  if (overlapping) {
    throw mockErrors.conflict(
      'CONFLICT',
      `${facility.name} đã có lịch bảo trì từ ${localOf(overlapping.startAt)} đến ${localOf(overlapping.endAt)}`,
    );
  }
  return facility;
}

/** `POST /maintenances/preview`: bookings to move and sessions that need a decision, each with its alternatives. */
export function previewMaintenance(request: MaintenanceRequest, facilities: Facility[]): MaintenancePreview {
  const facility = validateWindow(request, facilities);

  const affectedBookings: AffectedBooking[] = commerceStore
    .get()
    .bookings.filter(
      (entry) =>
        entry.status === 'CONFIRMED' &&
        entry.facility.id === facility.id &&
        !isPast(entry.date, entry.startTime) &&
        hits(request, entry.date, entry.startTime, entry.endTime),
    )
    .map((entry) => ({
      id: entry.id,
      account: entry.account,
      guestName: entry.guestName,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      packageId: entry.packageId,
      alternatives: facilities
        .filter(
          (other) =>
            other.isActive &&
            other.id !== facility.id &&
            other.sports.some((sport) => facility.sports.some((own) => own.id === sport.id)) &&
            roomAt(other, entry.date, entry.startTime, entry.endTime),
        )
        .map((other) => ({ id: other.id, name: other.name })),
    }))
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  const { classes, sessions } = classesStore.get();
  const affectedSessions: AffectedSession[] = sessions
    .filter(
      (session) =>
        session.status === 'SCHEDULED' &&
        session.facility.id === facility.id &&
        !isPast(session.date, session.startTime) &&
        hits(request, session.date, session.startTime, session.endTime),
    )
    .flatMap((session) => {
      const owner = classes.find((entry) => entry.id === session.classId);
      if (!owner || owner.status === 'CANCELLED') return [];
      const alternatives: Ref[] = facilities
        .filter(
          (entry) =>
            entry.isActive &&
            entry.id !== facility.id &&
            entry.sports.some((sport) => sport.id === owner.course.sport.id) &&
            freeAt(entry.id, session.date, session.startTime, session.endTime, session.id),
        )
        .map((entry) => ({ id: entry.id, name: entry.name }));
      return [
        {
          id: session.id,
          classId: owner.id,
          className: owner.name,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          alternatives,
        },
      ];
    })
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  return { affectedBookings, affectedSessions };
}

/** Why a chosen resolution cannot be applied, or `null` when it can. */
function blockReason(
  session: AffectedSession,
  resolution: SessionResolution,
  request: MaintenanceRequest,
  facilities: Facility[],
): string | null {
  if (resolution.action === 'MOVE_FACILITY') {
    const target = facilities.find((entry) => entry.id === resolution.facilityId);
    if (!target || !target.isActive) return 'Sân / phòng thay thế không khả dụng';
    if (!session.alternatives.some((entry) => entry.id === target.id))
      return `${target.name} không còn trống vào khung giờ này`;
    return null;
  }
  if (toMinutes(resolution.startTime) >= toMinutes(resolution.endTime)) return 'Giờ kết thúc phải sau giờ bắt đầu';
  if (isPast(resolution.date, resolution.startTime)) return 'Thời điểm mới đã qua';
  const facilityId = resolution.facilityId ?? request.facilityId;
  if (facilityId === request.facilityId && hits(request, resolution.date, resolution.startTime, resolution.endTime)) {
    return 'Thời điểm mới vẫn nằm trong khoảng bảo trì';
  }
  if (!freeAt(facilityId, resolution.date, resolution.startTime, resolution.endTime, session.id)) {
    return 'Sân / phòng đã có lịch vào thời điểm mới';
  }
  return null;
}

/**
 * `POST /maintenances` (BR_2.19): everything is re-checked, then bookings move to the chosen facility at the same time
 * (same price, no refund), sessions are moved or rescheduled and the maintenance is saved. Nothing changes when any
 * booking has nowhere to go or any session resolution cannot be applied.
 */
export function createMaintenance(
  actor: Actor,
  body: CreateMaintenanceBody,
  facilities: Facility[],
): CreateMaintenanceResult {
  const facility = validateWindow(body, facilities);
  const preview = previewMaintenance(body, facilities);

  const missingBookings = preview.affectedBookings.filter(
    (booking) => !body.bookingMoves.some((entry) => entry.bookingId === booking.id),
  );
  if (missingBookings.length > 0) {
    throw mockErrors.invalid('body.bookingMoves', `Còn ${missingBookings.length} booking chưa chọn sân thay thế`);
  }
  const missingSessions = preview.affectedSessions.filter(
    (session) => !body.sessionResolutions.some((entry) => entry.sessionId === session.id),
  );
  if (missingSessions.length > 0) {
    throw mockErrors.invalid('body.sessionResolutions', `Còn ${missingSessions.length} buổi học chưa có cách xử lý`);
  }

  const taken = new Map<string, number>();
  const blockedBookings: BlockedBooking[] = [];
  for (const booking of preview.affectedBookings) {
    const move = body.bookingMoves.find((entry) => entry.bookingId === booking.id)!;
    const target = facilities.find((entry) => entry.id === move.facilityId);
    const key = `${move.facilityId}|${booking.date}|${booking.startTime}`;
    const fits =
      target &&
      booking.alternatives.some((entry) => entry.id === target.id) &&
      roomAt(target, booking.date, booking.startTime, booking.endTime, taken.get(key) ?? 0);
    if (fits) taken.set(key, (taken.get(key) ?? 0) + 1);
    else {
      blockedBookings.push({
        bookingId: booking.id,
        who: booking.account?.fullName ?? booking.guestName ?? 'Khách',
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
      });
    }
  }
  const blockedSessions: BlockedSession[] = [];
  for (const session of preview.affectedSessions) {
    const resolution = body.sessionResolutions.find((entry) => entry.sessionId === session.id)!;
    const reason = blockReason(session, resolution, body, facilities);
    if (reason) {
      blockedSessions.push({
        sessionId: session.id,
        className: session.className,
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        reason,
      });
    }
  }
  if (blockedBookings.length > 0 || blockedSessions.length > 0) {
    throw mockErrors.conflict(
      'MAINTENANCE_BLOCKED',
      'Có booking hoặc buổi học không thể xử lý, chưa ghi nhận bảo trì',
      {
        bookings: blockedBookings,
        sessions: blockedSessions,
      },
    );
  }

  // Sessions first: if one fails after all, the class data goes back to how it was.
  const classesSnapshot = structuredClone(classesStore.get());
  try {
    for (const resolution of body.sessionResolutions) {
      updateSession(
        resolution.sessionId,
        resolution.action === 'MOVE_FACILITY'
          ? { facilityId: resolution.facilityId }
          : {
              date: resolution.date,
              startTime: resolution.startTime,
              endTime: resolution.endTime,
              facilityId: resolution.facilityId,
            },
        facilities,
      );
    }
  } catch (error) {
    classesStore.update((state) => {
      state.classes = classesSnapshot.classes;
      state.sessions = classesSnapshot.sessions;
      state.registrations = classesSnapshot.registrations;
    });
    const blockedBy = error instanceof Error ? error.message : 'Không thể xử lý buổi học';
    throw mockErrors.conflict('MAINTENANCE_BLOCKED', blockedBy, { bookings: [], sessions: [] });
  }

  for (const move of body.bookingMoves) {
    const target = facilities.find((entry) => entry.id === move.facilityId)!;
    moveBookingForMaintenance(move.bookingId, { id: target.id, name: target.name });
  }

  const maintenance: Maintenance = {
    id: newId(),
    facility: { id: facility.id, name: facility.name },
    startAt: body.startAt,
    endAt: body.endAt,
    reason: body.reason.trim(),
    createdAt: nowIso(),
    createdBy: { id: actor.id, fullName: actor.fullName },
  };
  store.update((state) => {
    state.items.push(maintenance);
  });
  return {
    maintenance,
    movedBookings: body.bookingMoves.length,
    sessionsUpdated: body.sessionResolutions.length,
  };
}

/** `DELETE /maintenances/{id}`: only a maintenance that has not started can be removed. */
export function deleteMaintenance(id: string) {
  const found = store.get().items.find((item) => item.id === id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lịch bảo trì');
  if (phaseOf(found) !== 'PLANNED') {
    throw mockErrors.conflict('INVALID_STATE', 'Chỉ hủy được lịch bảo trì chưa bắt đầu');
  }
  store.update((state) => {
    state.items = state.items.filter((item) => item.id !== id);
  });
}
