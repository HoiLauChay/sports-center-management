import type { Facility, Person, SystemSettings } from '@sports-center/shared';
import { commerceStore } from '~/lib/mock/commerce';
import { createMockStore, newId, nowIso } from '~/lib/mock/store';
import { addDays, dayOfWeek, slotGrid, todayVN } from '~/lib/time';
import type {
  ClassDerivedStatus,
  ClassSession,
  ClassStatus,
  CoachRegistration,
  Course,
  GymClass,
  GymClassDetail,
  WeeklySlot,
} from '../types';

export type StoredClass = Omit<GymClass, 'enrolledCount' | 'derivedStatus' | 'startDate' | 'endDate'> & {
  /** Students that were already enrolled before this browser's mock orders. */
  baseEnrolled: number;
  /** Copied from `GET /classes/{id}` so the mock checkout can price a real class. */
  mirrored?: boolean;
};

interface ClassesState {
  seeded: boolean;
  /** Set once the manager-side sample classes (draft, pending, ongoing, finished, cancelled) were added. */
  adminSeeded?: boolean;
  classes: StoredClass[];
  sessions: ClassSession[];
  registrations?: CoachRegistration[];
}

export const classesStore = createMockStore<ClassesState>('sc_mock_classes_v1', () => ({
  seeded: false,
  classes: [],
  sessions: [],
}));
const store = classesStore;

export const MOCK_COACHES: Person[] = [
  { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' },
  { id: 'mock-coach-lan', fullName: 'Trần Thị Lan' },
  { id: 'mock-coach-hung', fullName: 'Lê Quốc Hùng' },
  { id: 'mock-coach-thao', fullName: 'Phạm Thu Thảo' },
];

export function generateSessions(
  classId: string,
  facility: { id: string; name: string },
  startFrom: string,
  weekly: WeeklySlot[],
  total: number,
): ClassSession[] {
  const sessions: ClassSession[] = [];
  for (let offset = 0; sessions.length < total && offset < 400; offset += 1) {
    const date = addDays(startFrom, offset);
    const slot = weekly.find((entry) => entry.dayOfWeek === dayOfWeek(date));
    if (!slot) continue;
    sessions.push({
      id: newId(),
      classId,
      sessionNumber: sessions.length + 1,
      date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      facility,
      status: 'SCHEDULED',
      cancelReason: null,
    });
  }
  return sessions;
}

/**
 * The classes API is not available yet (#72, #89, #108), so a few open classes are generated on first use from the
 * real facilities. Their sessions occupy the facility slots, exactly like real class sessions do (BR_2.3).
 */
function seedOpenClasses(facilities: Facility[], settings: SystemSettings) {
  if (store.get().seeded) return;
  const candidates = facilities.filter((facility) => facility.isActive).slice(0, 4);
  if (!candidates.length) return;

  const grid = slotGrid(settings.openTime, settings.closeTime, settings.slotDurationMinutes);
  const evening = grid.find((slot) => slot.startTime >= '17:00') ?? grid.at(-1);
  if (!evening) return;
  const firstDay = addDays(todayVN(), 7);

  store.update((state) => {
    candidates.forEach((facility, index) => {
      const sport = facility.sports[0] ?? { id: 'sport-general', name: 'Thể thao' };
      const course: Course = {
        id: newId(),
        name: `${sport.name} cơ bản`,
        description: `Khóa ${sport.name.toLowerCase()} dành cho người mới: kỹ thuật nền tảng, thể lực và thực hành theo nhóm nhỏ.`,
        sport,
        totalSessions: 8,
        price: 1_200_000 + index * 300_000,
        thumbnailUrl: null,
      };
      const days = index % 2 === 0 ? [2, 4] : [1, 3, 5];
      const weeklySchedule: WeeklySlot[] = days.map((day) => ({
        dayOfWeek: day,
        startTime: evening.startTime,
        endTime: evening.endTime,
      }));
      const id = newId();
      const ref = { id: facility.id, name: facility.name };
      state.classes.push({
        id,
        name: `${course.name} · Lớp ${'ABCD'[index]}`,
        course,
        status: 'OPEN',
        weeklySchedule,
        facility: ref,
        coach: MOCK_COACHES[index % MOCK_COACHES.length]!,
        minStudents: 3,
        maxStudents: 10,
        cancelReason: null,
        baseEnrolled: 2 + index,
      });
      state.sessions.push(...generateSessions(id, ref, firstDay, weeklySchedule, course.totalSessions));
    });
    state.seeded = true;
  });
}

interface AdminSeed {
  suffix: string;
  status: ClassStatus;
  /** Index into `MOCK_COACHES`, `null` for no coach yet. */
  coach: number | null;
  /** Coach registrations: `[coach index, status, source]`. */
  registrations: [number, CoachRegistration['status'], CoachRegistration['source']][];
  /** First session date relative to today, in days. */
  start: number;
  days: number[];
  sessions: number;
  facility: number;
  enrolled: number;
  cancelReason?: string;
}

const ADMIN_SEEDS: AdminSeed[] = [
  {
    suffix: 'Lớp E (nháp)',
    status: 'DRAFT',
    coach: null,
    registrations: [],
    start: 14,
    days: [6, 0],
    sessions: 8,
    facility: 0,
    enrolled: 0,
  },
  {
    suffix: 'Lớp F (chờ HLV)',
    status: 'PENDING_APPROVAL',
    coach: null,
    registrations: [
      [0, 'PENDING', 'COACH_REGISTERED'],
      [2, 'PENDING', 'COACH_REGISTERED'],
    ],
    start: 12,
    days: [2, 5],
    sessions: 8,
    facility: 1,
    enrolled: 1,
  },
  {
    suffix: 'Lớp G (chờ duyệt)',
    status: 'PENDING_APPROVAL',
    coach: 1,
    registrations: [[1, 'APPROVED', 'COACH_REGISTERED']],
    start: 10,
    days: [1, 3],
    sessions: 6,
    facility: 2,
    enrolled: 2,
  },
  {
    suffix: 'Lớp H (đang học)',
    status: 'OPEN',
    coach: 3,
    registrations: [[3, 'APPROVED', 'MANAGER_ASSIGNED']],
    start: -9,
    days: [1, 3, 5],
    sessions: 12,
    facility: 0,
    enrolled: 6,
  },
  {
    suffix: 'Lớp I (đã kết thúc)',
    status: 'OPEN',
    coach: 0,
    registrations: [[0, 'APPROVED', 'COACH_REGISTERED']],
    start: -45,
    days: [2, 4],
    sessions: 8,
    facility: 1,
    enrolled: 7,
  },
  {
    suffix: 'Lớp K (đã hủy)',
    status: 'CANCELLED',
    coach: 2,
    registrations: [[2, 'APPROVED', 'COACH_REGISTERED']],
    start: 5,
    days: [6],
    sessions: 6,
    facility: 3,
    enrolled: 0,
    cancelReason: 'Không đủ sĩ số tối thiểu trước ngày khai giảng.',
  },
];

/** Sample manager-side classes in every state, so the class management pages can be tried before the API exists. */
function seedAdminClasses(facilities: Facility[], settings: SystemSettings) {
  if (store.get().adminSeeded) return;
  const candidates = facilities.filter((facility) => facility.isActive).slice(0, 4);
  if (!candidates.length) return;
  const grid = slotGrid(settings.openTime, settings.closeTime, settings.slotDurationMinutes);
  const morning = grid.find((slot) => slot.startTime >= '08:00') ?? grid[0];
  if (!morning) return;
  const today = todayVN();

  store.update((state) => {
    ADMIN_SEEDS.forEach((seed, index) => {
      const facility = candidates[seed.facility % candidates.length]!;
      const sport = facility.sports[0] ?? { id: 'sport-general', name: 'Thể thao' };
      const course: Course = {
        id: newId(),
        name: `${sport.name} nâng cao`,
        description: `Khóa ${sport.name.toLowerCase()} nâng cao: kỹ thuật chuyên sâu, chiến thuật và thi đấu nội bộ.`,
        sport,
        totalSessions: seed.sessions,
        price: 1_800_000 + index * 200_000,
        thumbnailUrl: null,
      };
      const weeklySchedule: WeeklySlot[] = seed.days.map((day) => ({
        dayOfWeek: day,
        startTime: morning.startTime,
        endTime: morning.endTime,
      }));
      const id = newId();
      const ref = { id: facility.id, name: facility.name };
      state.classes.push({
        id,
        name: `${course.name} · ${seed.suffix}`,
        course,
        status: seed.status,
        weeklySchedule,
        facility: ref,
        coach: seed.coach === null ? null : MOCK_COACHES[seed.coach]!,
        minStudents: 4,
        maxStudents: 12,
        cancelReason: seed.cancelReason ?? null,
        baseEnrolled: seed.enrolled,
      });
      const sessions = generateSessions(id, ref, addDays(today, seed.start), weeklySchedule, seed.sessions);
      if (seed.status === 'CANCELLED') {
        for (const session of sessions) {
          session.status = 'CANCELLED';
          session.cancelReason = seed.cancelReason ?? null;
        }
      }
      state.sessions.push(...sessions);
      (state.registrations ??= []).push(
        ...seed.registrations.map(([coach, status, source]) => ({
          id: newId(),
          classId: id,
          coach: MOCK_COACHES[coach]!,
          status,
          source,
          createdAt: nowIso(),
        })),
      );
    });
    state.adminSeeded = true;
  });
}

export function ensureClassSeed(facilities: Facility[], settings: SystemSettings) {
  seedOpenClasses(facilities, settings);
  seedAdminClasses(facilities, settings);
}

function derivedStatus(startDate: string | null, endDate: string | null): ClassDerivedStatus | null {
  if (!startDate || !endDate) return null;
  const today = todayVN();
  if (today < startDate) return 'UPCOMING';
  return today > endDate ? 'COMPLETED' : 'ONGOING';
}

export function toClass(stored: StoredClass, sessions: ClassSession[]): GymClass {
  const own = sessions.filter((session) => session.classId === stored.id);
  // A cancelled class keeps the dates it had; otherwise the dates come from the sessions that still stand (BR_2.10).
  const counted = own.filter((session) => stored.status === 'CANCELLED' || session.status === 'SCHEDULED');
  const dates = counted.map((session) => session.date).sort();
  const startDate = dates[0] ?? null;
  const endDate = dates.at(-1) ?? null;
  const enrolled = commerceStore
    .get()
    .enrollments.filter((enrollment) => enrollment.class.id === stored.id && enrollment.status === 'ENROLLED').length;
  const { baseEnrolled, ...rest } = stored;
  return {
    ...rest,
    startDate,
    endDate,
    enrolledCount: baseEnrolled + enrolled,
    derivedStatus: stored.status === 'OPEN' ? derivedStatus(startDate, endDate) : null,
  };
}

export const classesDb = {
  allClasses(): GymClass[] {
    const { classes, sessions } = store.get();
    return classes.map((stored) => toClass(stored, sessions));
  },

  findClass(id: string): GymClass | undefined {
    const { classes, sessions } = store.get();
    const stored = classes.find((entry) => entry.id === id);
    return stored && toClass(stored, sessions);
  },

  findDetail(id: string): GymClassDetail | undefined {
    const found = classesDb.findClass(id);
    return found && { ...found, sessions: classesDb.sessionsOf(id) };
  },

  sessionsOf(classId: string): ClassSession[] {
    return store
      .get()
      .sessions.filter((session) => session.classId === classId)
      .sort((a, b) => a.sessionNumber - b.sessionNumber);
  },

  registrationsOf(classId: string): CoachRegistration[] {
    return (store.get().registrations ?? [])
      .filter((entry) => entry.classId === classId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Class sessions that occupy a facility on a date (cancelled sessions and classes excluded). */
  sessionsAt(facilityId: string, date: string) {
    const { classes, sessions } = store.get();
    return sessions
      .filter(
        (session) => session.facility.id === facilityId && session.date === date && session.status === 'SCHEDULED',
      )
      .flatMap((session) => {
        const owner = classes.find((entry) => entry.id === session.classId);
        return owner && owner.status !== 'CANCELLED' ? [{ session, className: owner.name }] : [];
      });
  },

  /** Sessions of the classes a member is enrolled in, used to detect schedule clashes (BR_2.13). */
  enrolledSessions(accountId: string, excludeClassId?: string) {
    const classIds = new Set(
      commerceStore
        .get()
        .enrollments.filter((entry) => entry.account.id === accountId && entry.status === 'ENROLLED')
        .map((entry) => entry.class.id),
    );
    if (excludeClassId) classIds.delete(excludeClassId);
    return store.get().sessions.filter((session) => classIds.has(session.classId) && session.status === 'SCHEDULED');
  },

  /** Whether a class is a copy of a real one (see `mirror`), so it should be refreshed from the API. */
  isMirrored(id: string): boolean {
    return store.get().classes.some((entry) => entry.id === id && entry.mirrored);
  },

  /**
   * Copies a class from the API, with its sessions, into the mock store. The mock checkout (#110) prices and enrolls
   * from this store, so real classes need a copy until checkout calls the API.
   */
  mirror(detail: GymClassDetail) {
    store.update((state) => {
      const { id, name, course, status, weeklySchedule, facility, coach, minStudents, maxStudents, cancelReason } =
        detail;
      const stored: StoredClass = {
        id,
        name,
        course,
        status,
        weeklySchedule,
        facility,
        coach,
        minStudents,
        maxStudents,
        cancelReason,
        baseEnrolled: detail.enrolledCount,
        mirrored: true,
      };
      state.classes = [...state.classes.filter((entry) => entry.id !== detail.id), stored];
      state.sessions = [...state.sessions.filter((session) => session.classId !== detail.id), ...detail.sessions];
    });
  },

  /** A class still takes enrollments: OPEN, has a coach, has not started, has seats (BR_2.9). */
  enrollable(item: GymClass): boolean {
    return (
      item.status === 'OPEN' &&
      item.coach !== null &&
      item.derivedStatus === 'UPCOMING' &&
      item.enrolledCount < item.maxStudents
    );
  },
};
