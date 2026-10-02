import type { Facility, SystemSettings } from '@sports-center/shared';
import { commerceStore } from '~/lib/mock/commerce';
import { createMockStore, newId } from '~/lib/mock/store';
import { addDays, dayOfWeek, slotGrid, todayVN } from '~/lib/time';
import type { ClassDerivedStatus, ClassSession, Course, GymClass, GymClassDetail, WeeklySlot } from '../types';

type StoredClass = Omit<GymClass, 'enrolledCount' | 'derivedStatus' | 'startDate' | 'endDate'> & {
  /** Students that were already enrolled before this browser's mock orders. */
  baseEnrolled: number;
};

interface ClassesState {
  seeded: boolean;
  classes: StoredClass[];
  sessions: ClassSession[];
}

const store = createMockStore<ClassesState>('sc_mock_classes_v1', () => ({ seeded: false, classes: [], sessions: [] }));

const COACHES = [
  { id: 'mock-coach-minh', fullName: 'Nguyễn Văn Minh' },
  { id: 'mock-coach-lan', fullName: 'Trần Thị Lan' },
  { id: 'mock-coach-hung', fullName: 'Lê Quốc Hùng' },
  { id: 'mock-coach-thao', fullName: 'Phạm Thu Thảo' },
];

function generateSessions(
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
export function ensureClassSeed(facilities: Facility[], settings: SystemSettings) {
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
        coach: COACHES[index % COACHES.length]!,
        minStudents: 3,
        maxStudents: 10,
        minStudentsOverride: false,
        cancelReason: null,
        baseEnrolled: 2 + index,
      });
      state.sessions.push(...generateSessions(id, ref, firstDay, weeklySchedule, course.totalSessions));
    });
    state.seeded = true;
  });
}

function derivedStatus(startDate: string | null, endDate: string | null): ClassDerivedStatus | null {
  if (!startDate || !endDate) return null;
  const today = todayVN();
  if (today < startDate) return 'UPCOMING';
  return today > endDate ? 'COMPLETED' : 'ONGOING';
}

function toClass(stored: StoredClass, sessions: ClassSession[]): GymClass {
  const live = sessions.filter((session) => session.classId === stored.id && session.status === 'SCHEDULED');
  const dates = live.map((session) => session.date).sort();
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
