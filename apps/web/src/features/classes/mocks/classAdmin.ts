import type { Facility, Person } from '@sports-center/shared';
import { refundEnrollmentLine } from '~/features/bookings/mocks/bookings';
import type { BalanceOf } from '~/features/checkout/mocks/checkout';
import type { Actor } from '~/features/checkout/mocks/pricing';
import { enrollmentRefund } from '~/features/checkout/refundPolicy';
import { rosterOf } from '~/features/training/mocks/training';
import { formatDate } from '~/lib/format';
import { commerceStore } from '~/lib/mock/commerce';
import { mockErrors } from '~/lib/mock/errors';
import { newId, nowIso } from '~/lib/mock/store';
import { isPast, overlaps, todayVN, toMinutes } from '~/lib/time';
import type {
  ClassAdminDetail,
  ClassPatch,
  ClassSession,
  ClassStudent,
  CoachRegistration,
  Course,
  GymClass,
  RefundPreview,
  SessionPatch,
  WeeklySlot,
} from '../types';
import { classesDb, classesStore, generateSessions, MOCK_COACHES } from './classes';

/** Coaches a manager may assign directly (the real list comes from the users API once the class API ships). */
export const coachPool = (): Person[] => {
  const known = new Map<string, Person>();
  for (const coach of MOCK_COACHES) known.set(coach.id, coach);
  for (const item of classesDb.allClasses()) if (item.coach) known.set(item.coach.id, item.coach);
  return [...known.values()];
};

const hasStarted = (item: GymClass) => item.startDate !== null && todayVN() >= item.startDate;

function requireView(id: string): GymClass {
  const found = classesDb.findClass(id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');
  return found;
}

const sessionIsFuture = (session: ClassSession) => !isPast(session.date, session.startTime);

const enrolledOf = (classId: string) =>
  commerceStore.get().enrollments.filter((entry) => entry.class.id === classId && entry.status === 'ENROLLED');

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

export function getAdminDetail(id: string): ClassAdminDetail {
  const found = classesDb.findDetail(id);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');

  const students = getClassStudents(id);

  const classes = classesDb.allClasses();
  const coachRegistrations = classesDb.registrationsOf(id).map((entry) => ({
    ...entry,
    activeClasses: classes.filter(
      (item) => item.coach?.id === entry.coach.id && item.status === 'OPEN' && item.derivedStatus !== 'COMPLETED',
    ).length,
  }));
  const paid = students.filter((student) => student.paidAmount > 0);

  return {
    ...found,
    coachRegistrations,
    students,
    revenue: {
      lines: paid.length,
      total: paid.reduce((sum, student) => sum + student.paidAmount - student.refundedAmount, 0),
    },
  };
}

export function updateClass(id: string, patch: ClassPatch) {
  const view = requireView(id);
  if (view.status === 'CANCELLED' || hasStarted(view)) {
    throw mockErrors.conflict('INVALID_STATE', 'Chỉ sửa được thông tin lớp trước ngày bắt đầu');
  }
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) throw mockErrors.invalid('body.name', 'Vui lòng nhập tên lớp');
  const min = patch.minStudents ?? view.minStudents;
  const max = patch.maxStudents ?? view.maxStudents;
  if (min < 1) throw mockErrors.invalid('body.minStudents', 'Sĩ số tối thiểu phải từ 1');
  if (max < min) throw mockErrors.invalid('body.maxStudents', 'Sĩ số tối đa không được nhỏ hơn tối thiểu');
  if (max < view.enrolledCount) {
    throw mockErrors.invalid('body.maxStudents', `Đã có ${view.enrolledCount} học viên, không thể đặt thấp hơn`);
  }
  classesStore.update((state) => {
    const stored = state.classes.find((entry) => entry.id === id)!;
    if (name) stored.name = name;
    stored.minStudents = min;
    stored.maxStudents = max;
  });
  return requireView(id);
}

export function approveClass(id: string) {
  const view = requireView(id);
  if (view.status !== 'PENDING_APPROVAL')
    throw mockErrors.conflict('INVALID_STATE', 'Lớp không ở trạng thái chờ duyệt');
  if (!view.coach) throw mockErrors.conflict('INVALID_STATE', 'Lớp chưa có HLV, hãy phân công trước khi duyệt');
  if (!classesDb.sessionsOf(id).some((session) => session.status === 'SCHEDULED')) {
    throw mockErrors.conflict('INVALID_STATE', 'Lớp không còn buổi học nào nên không thể mở');
  }
  classesStore.update((state) => {
    state.classes.find((entry) => entry.id === id)!.status = 'OPEN';
  });
  return requireView(id);
}

export function rejectClass(id: string) {
  const view = requireView(id);
  if (view.status !== 'PENDING_APPROVAL')
    throw mockErrors.conflict('INVALID_STATE', 'Lớp không ở trạng thái chờ duyệt');
  classesStore.update((state) => {
    const stored = state.classes.find((entry) => entry.id === id)!;
    stored.status = 'DRAFT';
    stored.coach = null;
  });
  return requireView(id);
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

export function assignCoach(id: string, input: { registrationId: string } | { coachId: string }) {
  const view = requireView(id);
  if (view.status !== 'DRAFT' && view.status !== 'PENDING_APPROVAL') {
    throw mockErrors.conflict('INVALID_STATE', 'Chỉ phân công HLV khi lớp đang nháp hoặc chờ duyệt');
  }
  const registrations = classesStore.get().registrations ?? [];
  const registration =
    'registrationId' in input
      ? registrations.find((entry) => entry.id === input.registrationId && entry.classId === id)
      : undefined;
  if ('registrationId' in input && !registration) throw mockErrors.notFound('Không tìm thấy đăng ký dạy');
  const coach = registration
    ? registration.coach
    : coachPool().find((entry) => entry.id === (input as { coachId: string }).coachId);
  if (!coach) throw mockErrors.notFound('Không tìm thấy HLV');

  const clash = coachClash(
    coach.id,
    id,
    classesDb.sessionsOf(id).filter((session) => session.status === 'SCHEDULED'),
  );
  if (clash) throw mockErrors.conflict('SCHEDULE_CONFLICT', `HLV ${coach.fullName} ${clash}`);

  classesStore.update((state) => {
    const stored = state.classes.find((entry) => entry.id === id)!;
    const list = (state.registrations ??= []);
    let chosen = registration && list.find((entry) => entry.id === registration.id);
    chosen ??= list.find((entry) => entry.classId === id && entry.coach.id === coach.id && entry.status === 'PENDING');
    if (!chosen) {
      chosen = {
        id: newId(),
        classId: id,
        coach,
        status: 'PENDING',
        source: 'MANAGER_ASSIGNED',
        createdAt: nowIso(),
      } satisfies CoachRegistration;
      list.push(chosen);
    }
    for (const entry of list) {
      if (entry.classId === id && entry.status === 'PENDING' && entry.id !== chosen.id) entry.status = 'REJECTED';
    }
    chosen.status = 'APPROVED';
    stored.coach = coach;
    stored.status = 'PENDING_APPROVAL';
  });
  return requireView(id);
}

export function registerCoachForClass(classId: string, coach: Person, approvedSportIds: string[]) {
  const found = classesDb.findClass(classId);
  if (!found) throw mockErrors.notFound('Không tìm thấy lớp học');

  // Acceptance criteria: Chỉ cho phép đăng ký lớp thuộc bộ môn đã duyệt
  if (!approvedSportIds.includes(found.course.sport.id)) {
    throw mockErrors.conflict(
      'FORBIDDEN_SPORT',
      `HLV chưa được duyệt chuyên môn cho bộ môn ${found.course.sport.name}`,
    );
  }

  // Cannot register if already assigned as coach of this class
  if (found.coach && found.coach.id === coach.id) {
    throw mockErrors.conflict('ALREADY_ASSIGNED', 'Bạn đã được phân công đảm nhiệm lớp này');
  }

  // Check schedule conflict
  const sessions = classesDb.sessionsOf(classId).filter((s) => s.status === 'SCHEDULED');
  const clash = coachClash(coach.id, classId, sessions);
  if (clash) {
    throw mockErrors.conflict('SCHEDULE_CONFLICT', `Bạn bị ${clash}`);
  }

  classesStore.update((state) => {
    const list = (state.registrations ??= []);
    const existing = list.find((r) => r.classId === classId && r.coach.id === coach.id);
    if (existing) {
      if (existing.status === 'PENDING') {
        throw mockErrors.conflict('ALREADY_REGISTERED', 'Bạn đã đăng ký lớp này và đang chờ duyệt');
      }
      existing.status = 'PENDING';
      existing.createdAt = nowIso();
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
  });

  return { success: true };
}

export function getOpenClassesForCoach(coachId: string, approvedSportIds: string[]) {
  const allClasses = classesDb.allClasses();
  const registrations = classesStore.get().registrations ?? [];

  return allClasses
    .filter((c) => {
      // Acceptance criteria: Chỉ hiện lớp thuộc bộ môn đã duyệt
      if (!approvedSportIds.includes(c.course.sport.id)) return false;
      // Not cancelled and not completed
      if (c.status === 'CANCELLED' || c.derivedStatus === 'COMPLETED') return false;
      // Class needs a coach or hasn't had another coach approved
      if (c.coach && c.coach.id !== coachId) return false;
      return true;
    })
    .map((c) => {
      const reg = registrations.find((r) => r.classId === c.id && r.coach.id === coachId);
      return {
        ...c,
        hasApplied: Boolean(reg && reg.status === 'PENDING'),
        registrationStatus: reg?.status,
      };
    });
}

export function getClassesTaughtByCoach(coachId: string) {
  const allClasses = classesDb.allClasses();
  return allClasses.filter((c) => c.coach?.id === coachId);
}

export function classRefundPreview(id: string): RefundPreview {
  const view = requireView(id);
  const real = enrolledOf(id);
  const realAmount = real.reduce((sum, entry) => sum + enrollmentRefund(entry), 0);
  const baseAmount = (view.enrolledCount - real.length) * view.course.price;
  return { students: view.enrolledCount, amount: realAmount + baseAmount };
}

export async function cancelClass(actor: Actor, id: string, reason: string, balanceOf: BalanceOf) {
  const view = requireView(id);
  if (view.status === 'CANCELLED') throw mockErrors.conflict('INVALID_STATE', 'Lớp đã được hủy');
  const cleaned = reason.trim();
  if (!cleaned) throw mockErrors.invalid('body.reason', 'Vui lòng nhập lý do hủy lớp');

  // The list and the amounts are fixed before the status changes (BR_2.7b).
  const refundTotal = classRefundPreview(id).amount;
  for (const entry of enrolledOf(id)) {
    await refundEnrollmentLine(actor, entry.id, `Hoàn tiền lớp ${view.name} bị hủy`, balanceOf);
  }

  classesStore.update((state) => {
    const stored = state.classes.find((entry) => entry.id === id)!;
    stored.status = 'CANCELLED';
    stored.cancelReason = cleaned;
    for (const session of state.sessions) {
      if (session.classId === id && session.status === 'SCHEDULED' && sessionIsFuture(session)) {
        session.status = 'CANCELLED';
        session.cancelReason = cleaned;
      }
    }
  });
  return { class: requireView(id), refundTotal };
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

export interface ScheduleClash {
  date: string;
  startTime: string;
  endTime: string;
  reason: 'CLASS_SESSION' | 'BOOKED' | 'MAINTENANCE';
  classSession?: { id: string; classId: string; className: string };
  bookingId?: string;
  maintenance?: { id: string; reason: string };
}

export function createClass(
  input: {
    courseId: string;
    name: string;
    facilityId: string;
    startDate: string;
    weeklySchedule: WeeklySlot[];
    minStudents: number;
    maxStudents: number;
  },
  facilities: Facility[],
  courses: Course[],
) {
  const course = courses.find((c) => c.id === input.courseId);
  if (!course) throw mockErrors.invalid('body.courseId', 'Khóa học không tồn tại');

  const facility = facilities.find((f) => f.id === input.facilityId);
  if (!facility) throw mockErrors.invalid('body.facilityId', 'Cơ sở không tồn tại');

  if (!facility.sports.some((s) => s.id === course.sport.id)) {
    throw mockErrors.invalid('body.facilityId', `Cơ sở ${facility.name} không hỗ trợ bộ môn ${course.sport.name}`);
  }

  const id = newId();
  const ref = { id: facility.id, name: facility.name };
  const sessions = generateSessions(id, ref, input.startDate, input.weeklySchedule, course.totalSessions);

  // Acceptance criteria: Lỗi trùng lịch hiển thị buổi bị trùng
  const conflicts: ScheduleClash[] = [];
  for (const session of sessions) {
    const existing = classesDb.sessionsAt(facility.id, session.date);
    for (const { session: other, className } of existing) {
      if (overlaps(session.startTime, session.endTime, other.startTime, other.endTime)) {
        conflicts.push({
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          reason: 'CLASS_SESSION',
          classSession: { id: other.id, classId: other.classId, className },
        });
      }
    }
  }

  if (conflicts.length > 0) {
    const err = new Error('Lịch học bị trùng với lịch hiện có tại cơ sở') as Error & {
      status?: number;
      code?: string;
      conflicts?: ScheduleClash[];
    };
    err.status = 409;
    err.code = 'SCHEDULE_CONFLICT';
    err.conflicts = conflicts;
    throw err;
  }

  classesStore.update((state) => {
    state.classes.push({
      id,
      name: input.name.trim(),
      course,
      status: 'DRAFT',
      weeklySchedule: input.weeklySchedule,
      facility: ref,
      coach: null,
      minStudents: input.minStudents,
      maxStudents: input.maxStudents,
      cancelReason: null,
      baseEnrolled: 0,
    });
    state.sessions.push(...sessions);
  });

  return requireView(id);
}
