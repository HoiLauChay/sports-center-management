import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { sessionSelect as baseSessionSelect, taughtBy } from '~/repositories/class.repository';

const ref = { select: { id: true, name: true } } as const;

const bookingSelect = {
  id: true,
  bookingDate: true,
  startTime: true,
  endTime: true,
  status: true,
  facility: ref,
} satisfies Prisma.FacilityBookingSelect;

const sessionSelect = {
  ...baseSessionSelect,
  class: { select: { id: true, name: true, coachId: true, coach: { select: { id: true, fullName: true } } } },
} satisfies Prisma.ClassSessionSelect;

const coachSessionSelect = {
  ...sessionSelect,
  noteTitle: true,
  _count: { select: { attendances: true } },
  class: {
    select: {
      ...sessionSelect.class.select,
      enrollments: { select: { enrolledAt: true, cancelledAt: true } },
    },
  },
} satisfies Prisma.ClassSessionSelect;

export type PersonalBookingRow = Prisma.FacilityBookingGetPayload<{ select: typeof bookingSelect }>;
export type PersonalSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;
export type CoachSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof coachSessionSelect }>;

const between = (from: string, to: string) => ({ gte: new Date(from), lte: new Date(to) });
const orderBy = [
  { sessionDate: 'asc' },
  { startTime: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ClassSessionOrderByWithRelationInput[];

class PersonalScheduleRepository {
  findBookings = (accountId: string, from: string, to: string) =>
    prisma.facilityBooking.findMany({
      where: { accountId, bookingDate: between(from, to) },
      select: bookingSelect,
    });

  findMemberSessions = (accountId: string, from: string, to: string) =>
    prisma.classSession.findMany({
      where: {
        sessionDate: between(from, to),
        class: {
          enrollments: {
            some: {
              accountId,
              OR: [{ status: 'ENROLLED' }, { status: 'CANCELLED', class: { status: 'CANCELLED' } }],
            },
          },
        },
      },
      select: sessionSelect,
      orderBy,
    });

  findCoachSessions = (coachId: string, from: string, to: string) =>
    prisma.classSession.findMany({
      where: { ...taughtBy(coachId), sessionDate: between(from, to) },
      select: coachSessionSelect,
      orderBy,
    });
}

export default new PersonalScheduleRepository();
