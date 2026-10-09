import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

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
  id: true,
  classId: true,
  sessionNumber: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  status: true,
  cancelReason: true,
  facility: ref,
  class: { select: { id: true, name: true, coach: { select: { id: true, fullName: true } } } },
} satisfies Prisma.ClassSessionSelect;

export type PersonalBookingRow = Prisma.FacilityBookingGetPayload<{ select: typeof bookingSelect }>;
export type PersonalSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;

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
      where: { class: { coachId }, sessionDate: between(from, to) },
      select: sessionSelect,
      orderBy,
    });
}

export default new PersonalScheduleRepository();
