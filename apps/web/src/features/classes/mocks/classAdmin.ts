import { type Facility, type Person } from '@sports-center/shared';
import { formatDate } from '~/lib/format';
import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { isPast, overlaps, toMinutes } from '~/lib/time';
import type { ClassSession, GymClass, SessionPatch } from '../types';
import { classesDb, classesStore, MOCK_COACHES } from './classes';

function requireView(id: string): GymClass {
  const found = classesDb.findClass(id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');
  return found;
}

const sessionIsFuture = (session: ClassSession) => !isPast(session.date, session.startTime);

/** A coach cannot teach two sessions at the same time (BR_2.12); returns a readable clash, or `null`. */
export function coachClash(coachId: string, classId: string, sessions: ClassSession[]): string | null {
  const { classes, sessions: all } = classesStore.get();
  const busy = all.filter((session) => {
    if (session.classId === classId || session.status !== 'SCHEDULED') return false;
    const owner = classes.find((entry) => entry.id === session.classId);
    return owner?.coach?.id === coachId && owner.status !== 'CANCELLED';
  });
  for (const mine of sessions) {
    const hit = busy.find(
      (other) => other.date === mine.date && overlaps(mine.startTime, mine.endTime, other.startTime, other.endTime),
    );
    if (hit) {
      const owner = classes.find((entry) => entry.id === hit.classId);
      return `trùng lịch lớp "${owner?.name ?? ''}" ngày ${formatDate(hit.date)} ${hit.startTime}–${hit.endTime}`;
    }
  }
  return null;
}

function requireEditableSession(sessionId: string) {
  const { sessions } = classesStore.get();
  const session = sessions.find((entry) => entry.id === sessionId);
  if (!session) throw mockErrors.notFound('Không tìm thấy buổi học');
  const owner = requireView(session.classId);
  if (owner.status === 'CANCELLED') throw mockErrors.conflict('INVALID_STATE', 'Lớp đã bị hủy');
  if (session.status !== 'SCHEDULED') throw mockErrors.conflict('INVALID_STATE', 'Buổi học đã bị hủy');
  if (!sessionIsFuture(session)) throw mockErrors.conflict('INVALID_STATE', 'Buổi học đã diễn ra');
  return { session, owner };
}

export function updateSession(sessionId: string, patch: SessionPatch, facilities: Facility[]) {
  const { session, owner } = requireEditableSession(sessionId);
  const date = patch.date ?? session.date;
  const startTime = patch.startTime ?? session.startTime;
  const endTime = patch.endTime ?? session.endTime;
  if (toMinutes(startTime) >= toMinutes(endTime)) {
    throw mockErrors.invalid('body.endTime', 'Giờ kết thúc phải sau giờ bắt đầu');
  }
  if (isPast(date, startTime)) throw mockErrors.invalid('body.date', 'Thời điểm mới đã qua');

  let facility = session.facility;
  if (patch.facilityId && patch.facilityId !== session.facility.id) {
    const found = facilities.find((entry) => entry.id === patch.facilityId);
    if (!found || !found.isActive) throw mockErrors.invalid('body.facilityId', 'Sân / phòng không khả dụng');
    if (!found.sports.some((sport) => sport.id === owner.course.sport.id)) {
      throw mockErrors.invalid('body.facilityId', `${found.name} không dùng cho bộ môn ${owner.course.sport.name}`);
    }
    facility = { id: found.id, name: found.name };
  }

  const otherSession = classesDb
    .sessionsAt(facility.id, date)
    .find(
      (entry) =>
        entry.session.id !== sessionId && overlaps(startTime, endTime, entry.session.startTime, entry.session.endTime),
    );
  if (otherSession) {
    throw mockErrors.conflict(
      'SCHEDULE_CONFLICT',
      `${facility.name} đã có lớp "${otherSession.className}" vào khung giờ này`,
    );
  }
  const booking = commerceStore
    .get()
    .bookings.find(
      (entry) =>
        entry.status === 'CONFIRMED' &&
        entry.facility.id === facility.id &&
        entry.date === date &&
        overlaps(startTime, endTime, entry.startTime, entry.endTime),
    );
  if (booking) throw mockErrors.conflict('SCHEDULE_CONFLICT', `${facility.name} đã có người đặt vào khung giờ này`);
  if (owner.coach) {
    const clash = coachClash(owner.coach.id, owner.id, [{ ...session, date, startTime, endTime }]);
    if (clash) throw mockErrors.conflict('SCHEDULE_CONFLICT', `HLV ${owner.coach.fullName} ${clash}`);
  }

  classesStore.update((state) => {
    const stored = state.sessions.find((entry) => entry.id === sessionId)!;
    Object.assign(stored, { date, startTime, endTime, facility });
  });
  return classesStore.get().sessions.find((entry) => entry.id === sessionId)!;
}

/**
 * The mock classes belong to made-up coaches, so a coach who signs in would see an empty schedule. The first time a
 * coach uses a coach page, the classes of one sample coach are handed over to them (the real class API makes this
 * unnecessary).
 */
export function claimClassesForCoach(coach: Person) {
  const sample = MOCK_COACHES[3]!;
  if (classesStore.get().classes.some((entry) => entry.coach?.id === coach.id)) return;
  classesStore.update((state) => {
    for (const entry of state.classes)
      if (entry.coach?.id === sample.id) entry.coach = { id: coach.id, fullName: coach.fullName };
    for (const entry of state.registrations ?? []) {
      if (entry.coach.id === sample.id) entry.coach = { id: coach.id, fullName: coach.fullName };
    }
  });
}

/** What the manager dashboard needs about classes: how many wait for approval and the classes taking enrollments or running. */
export function classOverview() {
  const all = classesDb.allClasses();
  return {
    pendingApproval: all.filter((item) => item.status === 'PENDING_APPROVAL'),
    running: all
      .filter((item) => item.status === 'OPEN' && item.derivedStatus !== 'COMPLETED')
      .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? '')),
  };
}

/** `POST /classes`: a draft with every session generated from the weekly schedule, holding its facility slots (BR_2.3). */
