import type { Facility, Person } from '@sports-center/shared';
import { refundEnrollment } from '~/features/bookings/mocks/bookings';
import type { BalanceOf } from '~/features/checkout/mocks/checkout';
import type { Actor } from '~/features/checkout/mocks/pricing';
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
  GymClass,
  RefundPreview,
  SessionPatch,
} from '../types';
import { classesDb, classesStore, MOCK_COACHES } from './classes';

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

export function getAdminDetail(id: string): ClassAdminDetail {
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
  const students = [...real, ...base];

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

export function setMinStudentsOverride(id: string, override: boolean) {
  const view = requireView(id);
  if (view.status === 'CANCELLED' || hasStarted(view)) {
    throw mockErrors.conflict('INVALID_STATE', 'Chỉ đổi được trước ngày bắt đầu');
  }
  classesStore.update((state) => {
    state.classes.find((entry) => entry.id === id)!.minStudentsOverride = override;
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
function coachClash(coachId: string, classId: string, sessions: ClassSession[]): string | null {
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

/** Per-student price of one session (BR_2.23: the allocation of the session, whatever the member paid). */
const perSession = (paid: number, totalSessions: number) => Math.floor(paid / Math.max(1, totalSessions));

export function classRefundPreview(id: string): RefundPreview {
  const view = requireView(id);
  const left = classesDb
    .sessionsOf(id)
    .filter((session) => session.status === 'SCHEDULED' && sessionIsFuture(session)).length;
  const started = hasStarted(view);
  const total = view.course.totalSessions;
  const real = enrolledOf(id);
  const realAmount = real.reduce((sum, entry) => {
    const pending = entry.paidAmount - entry.refundedAmount;
    return sum + (started ? Math.min(pending, perSession(entry.paidAmount, total) * left) : pending);
  }, 0);
  const base = view.enrolledCount - real.length;
  const baseAmount = base * (started ? perSession(view.course.price, total) * left : view.course.price);
  return { students: view.enrolledCount, amount: realAmount + baseAmount };
}

export async function cancelClass(actor: Actor, id: string, reason: string, balanceOf: BalanceOf) {
  const view = requireView(id);
  if (view.status === 'CANCELLED') throw mockErrors.conflict('INVALID_STATE', 'Lớp đã được hủy');
  const cleaned = reason.trim();
  if (!cleaned) throw mockErrors.invalid('body.reason', 'Vui lòng nhập lý do hủy lớp');

  // The list and the amounts are fixed before the status changes (BR_2.7b).
  const started = hasStarted(view);
  const total = view.course.totalSessions;
  const left = classesDb
    .sessionsOf(id)
    .filter((session) => session.status === 'SCHEDULED' && sessionIsFuture(session)).length;
  const refundTotal = classRefundPreview(id).amount;
  for (const entry of enrolledOf(id)) {
    const pending = entry.paidAmount - entry.refundedAmount;
    const amount = started ? Math.min(pending, perSession(entry.paidAmount, total) * left) : pending;
    await refundEnrollment(actor, entry.id, amount, `Hoàn tiền lớp ${view.name} bị hủy`, balanceOf, { cancel: true });
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

export function sessionRefundPreview(sessionId: string): RefundPreview {
  const { session, owner } = requireEditableSession(sessionId);
  const total = owner.course.totalSessions;
  const real = enrolledOf(session.classId);
  const realAmount = real.reduce(
    (sum, entry) => sum + Math.min(entry.paidAmount - entry.refundedAmount, perSession(entry.paidAmount, total)),
    0,
  );
  const base = owner.enrolledCount - real.length;
  return { students: owner.enrolledCount, amount: realAmount + base * perSession(owner.course.price, total) };
}

export async function cancelSession(actor: Actor, sessionId: string, reason: string, balanceOf: BalanceOf) {
  const { session, owner } = requireEditableSession(sessionId);
  const cleaned = reason.trim();
  if (!cleaned) throw mockErrors.invalid('body.reason', 'Vui lòng nhập lý do hủy buổi');
  const remaining = classesDb.sessionsOf(session.classId).filter((entry) => entry.status === 'SCHEDULED');
  if (remaining.length <= 1) {
    throw mockErrors.conflict('INVALID_STATE', 'Đây là buổi cuối cùng còn lại, hãy dùng chức năng hủy lớp');
  }
  const refundTotal = sessionRefundPreview(sessionId).amount;
  const total = owner.course.totalSessions;
  for (const entry of enrolledOf(session.classId)) {
    await refundEnrollment(
      actor,
      entry.id,
      perSession(entry.paidAmount, total),
      `Hoàn tiền buổi ${session.sessionNumber} lớp ${owner.name} bị hủy`,
      balanceOf,
    );
  }
  classesStore.update((state) => {
    const stored = state.sessions.find((entry) => entry.id === sessionId)!;
    stored.status = 'CANCELLED';
    stored.cancelReason = cleaned;
  });
  return { session: classesStore.get().sessions.find((entry) => entry.id === sessionId)!, refundTotal };
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
