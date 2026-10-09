import { type Facility, type Person } from '@sports-center/shared';
import { rosterOf } from '~/features/training/mocks/training';
import { formatDate } from '~/lib/format';
import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { newId, nowIso } from '~/lib/mock/store';
import { isPast, overlaps, todayVN, toMinutes } from '~/lib/time';
import type { ClassSession, ClassStudent, CoachClassItem, GymClass, OpenClassItem, SessionPatch } from '../types';
import { classesDb, classesStore, MOCK_COACHES } from './classes';

function requireView(id: string): GymClass {
  const found = classesDb.findClass(id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');
  return found;
}

const sessionIsFuture = (session: ClassSession) => !isPast(session.date, session.startTime);

export function getClassStudents(id: string): ClassStudent[] {
  const found = classesDb.findDetail(id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');

  const cancelled = found.status === 'CANCELLED';
  const real: ClassStudent[] = commerceStore
    .get()
    .enrollments.filter((entry) => entry.class.id === id)
    .map((entry) => ({
      id: entry.account.id,
      fullName: entry.account.fullName,
      status: entry.status,
      enrolledAt: entry.enrolledAt,
      paidAmount: entry.paidAmount,
      refundedAmount: entry.refundedAmount,
    }));
  const base: ClassStudent[] = rosterOf(id, '9999-12-31')
    .filter((person) => person.id.startsWith('mock-student-'))
    .map((person) => ({
      id: person.id,
      fullName: person.fullName,
      status: cancelled ? 'CANCELLED' : 'ENROLLED',
      enrolledAt: null,
      paidAmount: found.course.price,
      refundedAmount: cancelled ? found.course.price : 0,
    }));
  return [...real, ...base];
}

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

/** A class still looks for a coach: a draft or waiting for approval, with nobody chosen yet (UC_2.13). */
const needsCoach = (item: GymClass) =>
  (item.status === 'DRAFT' || item.status === 'PENDING_APPROVAL') && item.coach === null;

/** The registration of a coach that still counts (a rejected one may be sent again). */
const activeRegistration = (classId: string, coachId: string) =>
  (classesStore.get().registrations ?? []).find(
    (entry) => entry.classId === classId && entry.coach.id === coachId && entry.status !== 'REJECTED',
  );

/** `/coach/open-classes`: classes of the coach's approved sports that still need a coach (BR_2.14). */
export function getOpenClassesForCoach(coachId: string, approvedSportIds: string[]): OpenClassItem[] {
  return classesDb
    .allClasses()
    .filter((item) => approvedSportIds.includes(item.course.sport.id))
    .filter((item) => needsCoach(item) || item.coach?.id === coachId)
    .filter((item) => item.status === 'DRAFT' || item.status === 'PENDING_APPROVAL')
    .map((item) => {
      const registration = activeRegistration(item.id, coachId);
      const sessions = classesDb.sessionsOf(item.id).filter((session) => session.status === 'SCHEDULED');
      return {
        ...item,
        registration: registration ? { id: registration.id, status: registration.status } : null,
        pendingRegistrations: classesDb.registrationsOf(item.id).filter((entry) => entry.status === 'PENDING').length,
        clash: registration ? null : coachClash(coachId, item.id, sessions),
      };
    })
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
}

/** A coach applies to teach a class; a draft then waits for the manager's approval (UC_2.13). */
export function registerCoachForClass(classId: string, coach: Person, approvedSportIds: string[]) {
  const found = classesDb.findClass(classId);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');
  if (!approvedSportIds.includes(found.course.sport.id)) {
    throw mockErrors.conflict('FORBIDDEN_SPORT', `Bạn chưa được duyệt chuyên môn ${found.course.sport.name}`);
  }
  if (!needsCoach(found)) throw mockErrors.conflict('INVALID_STATE', 'Lớp này không còn tuyển HLV');
  if (activeRegistration(classId, coach.id)) {
    throw mockErrors.conflict('ALREADY_REGISTERED', 'Bạn đã đăng ký lớp này và đang chờ duyệt');
  }

  const sessions = classesDb.sessionsOf(classId).filter((session) => session.status === 'SCHEDULED');
  const clash = coachClash(coach.id, classId, sessions);
  if (clash) throw mockErrors.conflict('SCHEDULE_CONFLICT', `Bạn bị ${clash}`);

  classesStore.update((state) => {
    const list = (state.registrations ??= []);
    const rejected = list.find((entry) => entry.classId === classId && entry.coach.id === coach.id);
    if (rejected) {
      rejected.status = 'PENDING';
      rejected.createdAt = nowIso();
    } else {
      list.push({
        id: newId(),
        classId,
        coach,
        status: 'PENDING',
        source: 'COACH_REGISTERED',
        createdAt: nowIso(),
      });
    }
    const stored = state.classes.find((entry) => entry.id === classId)!;
    if (stored.status === 'DRAFT') stored.status = 'PENDING_APPROVAL';
  });
  return requireView(classId);
}

/** A coach takes back a registration the manager has not acted on yet. */
export function withdrawCoachRegistration(classId: string, coachId: string) {
  const registration = activeRegistration(classId, coachId);
  if (!registration || registration.status !== 'PENDING') {
    throw mockErrors.conflict('INVALID_STATE', 'Chỉ rút được đăng ký đang chờ duyệt');
  }
  classesStore.update((state) => {
    state.registrations = (state.registrations ?? []).filter((entry) => entry.id !== registration.id);
  });
  return requireView(classId);
}

/** `/coach/classes`: the classes this coach is the current coach of. */
export function getClassesTaughtByCoach(coachId: string): CoachClassItem[] {
  const today = todayVN();
  return classesDb
    .allClasses()
    .filter((item) => item.coach?.id === coachId)
    .map((item) => ({
      ...item,
      attendanceSessionId:
        classesDb.sessionsOf(item.id).find((session) => session.status === 'SCHEDULED' && session.date >= today)?.id ??
        null,
    }))
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
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
