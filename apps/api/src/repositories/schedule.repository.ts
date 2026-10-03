import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { minutesInCenter, toCenterDateTime, todayInCenter, toDbTime } from '~/utils/time';

const facilityRef = { select: { id: true, name: true } } as const;

const upcomingFrom = (now: Date) => ({
  today: new Date(todayInCenter(now)),
  time: toDbTime(minutesInCenter(now)),
});

const bookingSelect = {
  id: true,
  bookingDate: true,
  startTime: true,
  endTime: true,
  facility: facilityRef,
} satisfies Prisma.FacilityBookingSelect;

const sessionSelect = {
  id: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  facility: facilityRef,
  class: { select: { id: true, name: true } },
} satisfies Prisma.ClassSessionSelect;

export type UpcomingBooking = Prisma.FacilityBookingGetPayload<{ select: typeof bookingSelect }>;
export type UpcomingSession = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;

const timeRange = { startTime: true, endTime: true } as const;

const liveSession = { status: 'SCHEDULED', class: { deletedAt: null, status: { not: 'CANCELLED' } } } as const;

const sessionUsageSelect = {
  id: true,
  sessionDate: true,
  ...timeRange,
  class: { select: { id: true, name: true } },
} satisfies Prisma.ClassSessionSelect;

export type SessionUsage = Prisma.ClassSessionGetPayload<{ select: typeof sessionUsageSelect }>;

const toDays = (dates: string[]) => dates.map((date) => new Date(date));

class ScheduleRepository {
  findFacilityUsage = (facilityId: string, dates: string[], tx: Prisma.TransactionClient = prisma) => {
    const sorted = [...dates].sort();
    return Promise.all([
      tx.facility.findUnique({
        where: { id: facilityId },
        select: { id: true, name: true, capacityPerSlot: true, isActive: true, deletedAt: true },
      }),
      tx.facilityBooking.findMany({
        where: { facilityId, status: 'CONFIRMED', bookingDate: { in: toDays(dates) } },
        select: { id: true, bookingDate: true, ...timeRange },
      }),
      tx.classSession.findMany({
        where: { facilityId, ...liveSession, sessionDate: { in: toDays(dates) } },
        select: sessionUsageSelect,
      }),
      tx.facilityMaintenance.findMany({
        where: {
          facilityId,
          deletedAt: null,
          startAt: { lt: toCenterDateTime(sorted.at(-1)!, 24 * 60) },
          endAt: { gt: toCenterDateTime(sorted[0]!, 0) },
        },
        select: { id: true, startAt: true, endAt: true, reason: true },
      }),
    ]);
  };

  findCoachSessions = (coachId: string, dates: string[], tx: Prisma.TransactionClient = prisma) =>
    tx.classSession.findMany({
      where: { ...liveSession, class: { ...liveSession.class, coachId }, sessionDate: { in: toDays(dates) } },
      select: sessionUsageSelect,
    });

  findMemberCommitments = (accountId: string, dates: string[], tx: Prisma.TransactionClient = prisma) =>
    Promise.all([
      tx.facilityBooking.findMany({
        where: { accountId, status: 'CONFIRMED', bookingDate: { in: toDays(dates) } },
        select: { id: true, bookingDate: true, ...timeRange },
      }),
      tx.classSession.findMany({
        where: {
          ...liveSession,
          class: { ...liveSession.class, enrollments: { some: { accountId, status: 'ENROLLED' } } },
          sessionDate: { in: toDays(dates) },
        },
        select: sessionUsageSelect,
      }),
    ]);

  findUpcomingBookings = (
    where: Prisma.FacilityBookingWhereInput = {},
    tx: Prisma.TransactionClient = prisma,
    now = new Date(),
  ) => {
    const { today, time } = upcomingFrom(now);
    return tx.facilityBooking.findMany({
      where: {
        AND: [
          where,
          { status: 'CONFIRMED' },
          { OR: [{ bookingDate: { gt: today } }, { bookingDate: today, startTime: { gte: time } }] },
        ],
      },
      select: bookingSelect,
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }],
    });
  };

  findUpcomingSessions = (
    where: Prisma.ClassSessionWhereInput = {},
    tx: Prisma.TransactionClient = prisma,
    now = new Date(),
  ) => {
    const { today, time } = upcomingFrom(now);
    return tx.classSession.findMany({
      where: {
        AND: [
          where,
          { status: 'SCHEDULED', class: { deletedAt: null, status: { not: 'CANCELLED' } } },
          { OR: [{ sessionDate: { gt: today } }, { sessionDate: today, startTime: { gte: time } }] },
        ],
      },
      select: sessionSelect,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
    });
  };
}

export default new ScheduleRepository();
