import type { Person } from '@sports-center/shared';
import { classesDb, classesStore } from '~/features/classes/mocks/classes';
import { commerceStore } from '~/lib/mock/commerce';
import type { CoachScheduleEntry, DaySession, ScheduleEntry, ScheduleRange } from '../types';

const inRange = (date: string, range: ScheduleRange) => date >= range.from && date <= range.to;

const byTime = (a: { date: string; startTime: string }, b: { date: string; startTime: string }) =>
  `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);

/** `GET /me/schedule`: bookings plus the sessions of every class the member is (or was) enrolled in (BR_2.9). */
export function mySchedule(accountId: string, range: ScheduleRange): ScheduleEntry[] {
  const state = commerceStore.get();
  const bookings: ScheduleEntry[] = state.bookings
    .filter((booking) => booking.account?.id === accountId && inRange(booking.date, range))
    .map((booking) => ({
      kind: 'BOOKING',
      id: booking.id,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      facility: booking.facility,
      status: booking.status,
    }));

  const classIds = new Set(
    state.enrollments.filter((entry) => entry.account.id === accountId).map((entry) => entry.class.id),
  );
  const sessions: ScheduleEntry[] = classesStore
    .get()
    .sessions.filter((session) => classIds.has(session.classId) && inRange(session.date, range))
    .flatMap((session) => {
      const owner = classesDb.findClass(session.classId);
      return owner
        ? [
            {
              kind: 'CLASS_SESSION' as const,
              id: session.id,
              date: session.date,
              startTime: session.startTime,
              endTime: session.endTime,
              facility: session.facility,
              class: { id: owner.id, name: owner.name, coach: owner.coach },
              status: session.status,
            },
          ]
        : [];
    });

  return [...bookings, ...sessions].sort(byTime);
}

/** `GET /coach/schedule`: the sessions of the open classes a coach teaches. */
export function coachSchedule(coach: Person, range: ScheduleRange): CoachScheduleEntry[] {
  const owned = classesDb.allClasses().filter((item) => item.coach?.id === coach.id && item.status === 'OPEN');
  return classesStore
    .get()
    .sessions.filter((session) => inRange(session.date, range) && owned.some((item) => item.id === session.classId))
    .map((session) => {
      const owner = owned.find((item) => item.id === session.classId)!;
      return { ...session, class: { id: owner.id, name: owner.name } };
    })
    .sort(byTime);
}

/** Sessions of the open classes that take place on `date`, in time order (reception and manager dashboards). */
export function sessionsOn(date: string): DaySession[] {
  const open = classesDb.allClasses().filter((item) => item.status === 'OPEN');
  return classesStore
    .get()
    .sessions.filter((session) => session.date === date && session.status === 'SCHEDULED')
    .flatMap((session) => {
      const owner = open.find((item) => item.id === session.classId);
      return owner
        ? [
            {
              id: session.id,
              classId: owner.id,
              className: owner.name,
              startTime: session.startTime,
              endTime: session.endTime,
              facility: session.facility,
              coach: owner.coach?.fullName ?? null,
              enrolled: owner.enrolledCount,
              maxStudents: owner.maxStudents,
            },
          ]
        : [];
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
