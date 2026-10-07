import type { Person } from '@sports-center/shared';
import type { Actor } from '~/features/checkout/mocks/pricing';
import { classesDb, classesStore } from '~/features/classes/mocks/classes';
import type { ClassSession, GymClass } from '~/features/classes/types';
import { commerceStore } from '~/lib/mock/commerce';
import { MockApiError, mockErrors } from '~/lib/mock/errors';
import { createMockStore, newId, nowIso } from '~/lib/mock/store';
import { todayVN, vnDate } from '~/lib/time';
import type {
  Announcement,
  AttendanceInput,
  AttendanceRecord,
  AttendanceStatus,
  CheckIn,
  CheckInBasis,
  CheckInCheck,
  Evaluation,
  EvaluationInput,
  MyAttendanceRow,
  SessionNote,
  SessionNoteInput,
  TrainingSession,
} from '../types';

interface StoredAttendance {
  status: AttendanceStatus;
  note: string | null;
  updatedBy: Person;
  updatedAt: string;
}

type StoredEvaluation = Omit<Evaluation, 'session'> & { sessionId: string; deletedAt: string | null };

interface TrainingState {
  /** Keyed by `sessionId|accountId`: at most one record per (student, session) (BR_4.2). */
  attendance: Record<string, StoredAttendance>;
  notes: Record<string, SessionNote>;
  evaluations: StoredEvaluation[];
  announcements: Announcement[];
  checkIns: CheckIn[];
}

const store = createMockStore<TrainingState>('sc_mock_training_v1', () => ({
  attendance: {},
  notes: {},
  evaluations: [],
  announcements: [],
  checkIns: [],
}));

const BASE_STUDENTS = [
  'Đỗ Minh Quân',
  'Vũ Hà My',
  'Bùi Gia Huy',
  'Ngô Khánh Linh',
  'Hoàng Đức Anh',
  'Đặng Thu Trang',
  'Phan Quốc Bảo',
  'Lý Mai Chi',
  'Trương Nhật Nam',
  'Đinh Ngọc Hân',
  'Mai Tuấn Kiệt',
  'Cao Bảo Ngân',
];

const attendanceKey = (sessionId: string, accountId: string) => `${sessionId}|${accountId}`;

/**
 * Students that belong to a session: those enrolled by the session's date (BR_4.2). The students that were already
 * enrolled before this browser's mock orders are generated, the others are the real accounts that bought the class.
 */
export function rosterOf(classId: string, sessionDate: string): Person[] {
  const stored = classesStore.get().classes.find((entry) => entry.id === classId);
  const real = commerceStore
    .get()
    .enrollments.filter(
      (entry) => entry.class.id === classId && entry.status === 'ENROLLED' && vnDate(entry.enrolledAt) <= sessionDate,
    )
    .map((entry) => entry.account);
  const base = Array.from({ length: stored?.baseEnrolled ?? 0 }, (_, index) => ({
    id: `mock-student-${classId}-${index}`,
    fullName: BASE_STUDENTS[index % BASE_STUDENTS.length]!,
  }));
  return [...real, ...base];
}

function findSession(sessionId: string): { session: ClassSession; owner: GymClass } {
  const session = classesStore.get().sessions.find((entry) => entry.id === sessionId);
  const owner = session && classesDb.findClass(session.classId);
  if (!session || !owner) throw mockErrors.notFound('Không tìm thấy buổi học');
  return { session, owner };
}

const forbidden = (message: string) => new MockApiError(403, 'FORBIDDEN', message);

/** A coach only works on their own classes, a manager on every class (BR_4.3). */
function requireStaffSession(user: Actor, sessionId: string) {
  const found = findSession(sessionId);
  if (user.role === 'COACH' && found.owner.coach?.id !== user.id) throw forbidden('Bạn không phụ trách lớp này');
  return found;
}

function isEnrolled(accountId: string, classId: string) {
  return commerceStore.get().enrollments.some((entry) => entry.account.id === accountId && entry.class.id === classId);
}

/** Staff of the class, or a member that joined it. */
function requireReadableSession(user: Actor, sessionId: string) {
  const found = findSession(sessionId);
  if (user.role === 'MEMBER' && !isEnrolled(user.id, found.owner.id)) throw forbidden('Bạn chưa đăng ký lớp này');
  if (user.role === 'COACH' && found.owner.coach?.id !== user.id) throw forbidden('Bạn không phụ trách lớp này');
  return found;
}

function requireOpenSession(session: ClassSession, owner: GymClass) {
  if (owner.status === 'CANCELLED' || session.status === 'CANCELLED') {
    throw mockErrors.conflict('INVALID_STATE', 'Buổi học đã bị hủy');
  }
}

export function getTrainingSession(user: Actor, sessionId: string): TrainingSession {
  const { session, owner } = requireStaffSession(user, sessionId);
  return {
    session,
    class: { id: owner.id, name: owner.name, sport: owner.course.sport, coach: owner.coach },
    studentCount: rosterOf(owner.id, session.date).length,
  };
}

function toRecord(student: Person, saved: StoredAttendance | undefined): AttendanceRecord {
  return {
    account: student,
    status: saved?.status ?? null,
    note: saved?.note ?? null,
    updatedBy: saved?.updatedBy ?? null,
    updatedAt: saved?.updatedAt ?? null,
  };
}

export function getAttendance(user: Actor, sessionId: string): AttendanceRecord[] {
  const { session, owner } = requireStaffSession(user, sessionId);
  const { attendance } = store.get();
  return rosterOf(owner.id, session.date).map((student) =>
    toRecord(student, attendance[attendanceKey(sessionId, student.id)]),
  );
}

/** `PUT /sessions/{id}/attendance`: the whole class in one save. */
export function saveAttendance(user: Actor, sessionId: string, records: AttendanceInput[]): AttendanceRecord[] {
  const { session, owner } = requireStaffSession(user, sessionId);
  requireOpenSession(session, owner);
  const roster = rosterOf(owner.id, session.date);
  for (const record of records) {
    if (!roster.some((student) => student.id === record.accountId)) {
      throw mockErrors.invalid('body.records', 'Có học viên không thuộc buổi học này');
    }
  }
  const by = { id: user.id, fullName: user.fullName };
  store.update((state) => {
    for (const record of records) {
      state.attendance[attendanceKey(sessionId, record.accountId)] = {
        status: record.status,
        note: record.note?.trim() || null,
        updatedBy: by,
        updatedAt: nowIso(),
      };
    }
  });
  return getAttendance(user, sessionId);
}

export function getNote(user: Actor, sessionId: string): SessionNote | null {
  requireReadableSession(user, sessionId);
  return store.get().notes[sessionId] ?? null;
}

export function putNote(user: Actor, sessionId: string, input: SessionNoteInput): SessionNote {
  const { session, owner } = requireStaffSession(user, sessionId);
  requireOpenSession(session, owner);
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) throw mockErrors.invalid('body.title', 'Vui lòng nhập tiêu đề');
  if (!content) throw mockErrors.invalid('body.content', 'Vui lòng nhập nội dung');
  const note: SessionNote = {
    title,
    content,
    attachments: (input.attachments ?? []).map((entry) => entry.trim()).filter(Boolean),
    updatedAt: nowIso(),
  };
  store.update((state) => {
    state.notes[sessionId] = note;
  });
  return note;
}

function toEvaluation(entry: StoredEvaluation): Evaluation | null {
  const session = classesStore.get().sessions.find((item) => item.id === entry.sessionId);
  if (!session) return null;
  return {
    id: entry.id,
    session,
    account: entry.account,
    coach: entry.coach,
    rating: entry.rating,
    comment: entry.comment,
    createdAt: entry.createdAt,
  };
}

export function listEvaluations(user: Actor, sessionId: string): Evaluation[] {
  requireStaffSession(user, sessionId);
  return store
    .get()
    .evaluations.filter((entry) => entry.sessionId === sessionId && !entry.deletedAt)
    .flatMap((entry) => toEvaluation(entry) ?? []);
}

function validateRating(rating: number) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw mockErrors.invalid('body.rating', 'Điểm đánh giá từ 1 đến 5');
  }
}

export function createEvaluation(user: Actor, sessionId: string, input: EvaluationInput): Evaluation {
  const { session, owner } = requireStaffSession(user, sessionId);
  if (user.role !== 'COACH') throw forbidden('Chỉ HLV của lớp mới đánh giá học viên');
  requireOpenSession(session, owner);
  validateRating(input.rating);
  const student = rosterOf(owner.id, session.date).find((entry) => entry.id === input.accountId);
  if (!student) throw mockErrors.invalid('body.accountId', 'Học viên không thuộc buổi học này');
  const exists = store
    .get()
    .evaluations.some((entry) => entry.sessionId === sessionId && entry.account.id === student.id && !entry.deletedAt);
  if (exists) throw mockErrors.conflict('CONFLICT', 'Học viên này đã có đánh giá trong buổi học');
  const created: StoredEvaluation = {
    id: newId(),
    sessionId,
    account: student,
    coach: { id: user.id, fullName: user.fullName },
    rating: input.rating,
    comment: input.comment?.trim() || null,
    createdAt: nowIso(),
    deletedAt: null,
  };
  store.update((state) => {
    state.evaluations.push(created);
  });
  return toEvaluation(created)!;
}

function requireEvaluation(user: Actor, id: string) {
  const found = store.get().evaluations.find((entry) => entry.id === id && !entry.deletedAt);
  if (!found) throw mockErrors.notFound('Không tìm thấy đánh giá');
  if (user.role === 'COACH' && found.coach.id !== user.id) throw forbidden('Chỉ tác giả được sửa đánh giá');
  return found;
}

export function updateEvaluation(user: Actor, id: string, patch: { rating?: number; comment?: string }) {
  requireEvaluation(user, id);
  if (patch.rating !== undefined) validateRating(patch.rating);
  store.update((state) => {
    const entry = state.evaluations.find((item) => item.id === id)!;
    if (patch.rating !== undefined) entry.rating = patch.rating;
    if (patch.comment !== undefined) entry.comment = patch.comment.trim() || null;
  });
}

/** Soft delete: a new evaluation may then be written for the same student and session (BR_4.5). */
export function deleteEvaluation(user: Actor, id: string) {
  requireEvaluation(user, id);
  store.update((state) => {
    state.evaluations.find((item) => item.id === id)!.deletedAt = nowIso();
  });
}

export function sendAnnouncement(user: Actor, classId: string, input: { title: string; body: string }) {
  const owner = classesDb.findClass(classId);
  if (!owner) throw mockErrors.notFound('Không tìm thấy lớp học');
  if (user.role === 'COACH' && owner.coach?.id !== user.id) throw forbidden('Bạn không phụ trách lớp này');
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw mockErrors.invalid('body.title', 'Vui lòng nhập tiêu đề');
  if (!body) throw mockErrors.invalid('body.body', 'Vui lòng nhập nội dung');
  const recipients = rosterOf(classId, '9999-12-31').length;
  store.update((state) => {
    state.announcements.push({ id: newId(), classId, title, body, recipients, createdAt: nowIso() });
  });
  return { recipients };
}

export function listAnnouncements(classId: string): Announcement[] {
  return store
    .get()
    .announcements.filter((entry) => entry.classId === classId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Classes a member joined, newest first: what the member's training page lets them pick from. */
export function myClasses(accountId: string): GymClass[] {
  const ids = [
    ...new Set(
      commerceStore
        .get()
        .enrollments.filter((entry) => entry.account.id === accountId)
        .map((entry) => entry.class.id),
    ),
  ];
  return ids.flatMap((id) => classesDb.findClass(id) ?? []);
}

/** `GET /me/attendance`: every live session of the classes I joined with the mark the coach gave. */
export function myAttendance(accountId: string, classId?: string): MyAttendanceRow[] {
  const { attendance } = store.get();
  return myClasses(accountId)
    .filter((item) => !classId || item.id === classId)
    .flatMap((item) => classesDb.sessionsOf(item.id))
    .filter((session) => session.status === 'SCHEDULED')
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
    .map((session) => {
      const saved = attendance[attendanceKey(session.id, accountId)];
      return { session, status: saved?.status ?? null, note: saved?.note ?? null };
    });
}

export function myEvaluations(accountId: string, classId?: string): Evaluation[] {
  const sessions = classesStore.get().sessions;
  return store
    .get()
    .evaluations.filter((entry) => {
      if (entry.account.id !== accountId || entry.deletedAt) return false;
      return !classId || sessions.find((item) => item.id === entry.sessionId)?.classId === classId;
    })
    .flatMap((entry) => toEvaluation(entry) ?? [])
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function myCheckIns(accountId: string, range: { from?: string; to?: string }): CheckIn[] {
  return store
    .get()
    .checkIns.filter((entry) => {
      if (entry.account.id !== accountId) return false;
      const day = vnDate(entry.checkedInAt);
      return (!range.from || day >= range.from) && (!range.to || day <= range.to);
    })
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
}

export function checkInsToday(): CheckIn[] {
  const today = todayVN();
  return store
    .get()
    .checkIns.filter((entry) => vnDate(entry.checkedInAt) === today)
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
}

/**
 * BR_4.1: a member may check in with a confirmed booking today, a session of a class they joined today, or a
 * membership that gives gym access. Check-in neither replaces a booking nor holds capacity.
 */
export function checkInCheck(
  member: Person & { status: string; phone: string | null },
  gymAccess: boolean,
): CheckInCheck {
  const today = todayVN();
  const state = commerceStore.get();
  const bookingsToday = state.bookings
    .filter((entry) => entry.account?.id === member.id && entry.date === today && entry.status === 'CONFIRMED')
    .map((entry) => ({ id: entry.id, facility: entry.facility, startTime: entry.startTime, endTime: entry.endTime }));

  const joined = new Set(
    state.enrollments
      .filter((entry) => entry.account.id === member.id && entry.status === 'ENROLLED')
      .map((entry) => entry.class.id),
  );
  const sessionsToday = classesStore
    .get()
    .sessions.filter((entry) => entry.date === today && entry.status === 'SCHEDULED' && joined.has(entry.classId))
    .flatMap((entry) => {
      const owner = classesDb.findClass(entry.classId);
      return owner && owner.status === 'OPEN'
        ? [
            {
              id: entry.id,
              className: owner.name,
              facility: entry.facility,
              startTime: entry.startTime,
              endTime: entry.endTime,
            },
          ]
        : [];
    });

  const basis: CheckInBasis | null = bookingsToday.length
    ? 'BOOKING'
    : sessionsToday.length
      ? 'CLASS_SESSION'
      : gymAccess
        ? 'MEMBERSHIP'
        : null;

  const reasons: string[] = [];
  if (member.status !== 'ACTIVE') reasons.push('Tài khoản không ở trạng thái hoạt động.');
  if (!basis) {
    reasons.push('Không có booking sân / phòng nào được xác nhận trong hôm nay.');
    reasons.push('Không có buổi học nào hôm nay của lớp đã đăng ký.');
    reasons.push('Không có gói thành viên còn hiệu lực với quyền vào gym.');
  }

  const last = checkInsToday().find((entry) => entry.account.id === member.id);
  return {
    member,
    eligible: member.status === 'ACTIVE' && basis !== null,
    basis,
    reasons,
    bookingsToday,
    sessionsToday,
    gymAccess,
    lastCheckInToday: last?.checkedInAt ?? null,
  };
}

export function createCheckIn(staff: Actor, check: CheckInCheck): CheckIn {
  if (!check.eligible || !check.basis) {
    throw new MockApiError(409, 'CHECKIN_NOT_ALLOWED', check.reasons[0] ?? 'Thành viên chưa đủ điều kiện check-in');
  }
  const created: CheckIn = {
    id: newId(),
    account: { id: check.member.id, fullName: check.member.fullName },
    checkedInAt: nowIso(),
    basis: check.basis,
    by: { id: staff.id, fullName: staff.fullName },
  };
  store.update((state) => {
    state.checkIns.push(created);
  });
  return created;
}
