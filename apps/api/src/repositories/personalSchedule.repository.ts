import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const ref = { select: { id: true, name: true } } as const;
const coachRef = { select: { id: true, fullName: true } } as const;

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
  class: { select: { id: true, name: true, coach: coachRef } },
} satisfies Prisma.ClassSessionSelect;

export type PersonalBookingRow = Prisma.FacilityBookingGetPayload<{ select: typeof bookingSelect }>;
export type PersonalSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof sessionSelect }>;

class PersonalScheduleRepository {
  member = async (accountId: string, from: string, to: string) => {
    const period = { gte: new Date(from), lte: new Date(to) };
    return Promise.all([
      prisma.facilityBooking.findMany({
        where: { accountId, bookingDate: period },
        select: bookingSelect,
        orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      }),
      prisma.classSession.findMany({
        where: {
          sessionDate: period,
          class: {
            enrollments: {
              some: {
                accountId,
                OR: [
                  { status: 'ENROLLED' },
                  // Class cancellation automatically cancels enrollment while retaining its history.
                  { status: 'CANCELLED', class: { status: 'CANCELLED' } },
                ],
              },
            },
          },
        },
        select: sessionSelect,
        orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
      }),
    ]);
  };

  coach = (coachId: string, from: string, to: string) =>
    prisma.classSession.findMany({
      where: { class: { coachId }, sessionDate: { gte: new Date(from), lte: new Date(to) } },
      select: sessionSelect,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });
}

export default new PersonalScheduleRepository();
