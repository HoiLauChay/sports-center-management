import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { minutesInCenter, todayInCenter, toDbTime } from '~/utils/time';

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

class ScheduleRepository {
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
