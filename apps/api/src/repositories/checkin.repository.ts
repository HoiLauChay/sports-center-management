import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const person = { select: { id: true, fullName: true } } as const;

const checkinSelect = {
  id: true,
  checkInTime: true,
  account: person,
  checkedBy: person,
} satisfies Prisma.CenterCheckinSelect;

export type CheckinRow = Prisma.CenterCheckinGetPayload<{ select: typeof checkinSelect }>;

interface Window {
  from?: Date;
  to?: Date;
}

const within = ({ from, to }: Window) => ({ gte: from, lt: to });

class CheckinRepository {
  create = (accountId: string, checkedById: string) =>
    prisma.centerCheckin.create({ data: { accountId, checkedById }, select: checkinSelect });

  findByAccount = (accountId: string, window: Window) =>
    prisma.centerCheckin.findMany({
      where: { accountId, checkInTime: within(window) },
      select: checkinSelect,
      orderBy: [{ checkInTime: 'desc' }, { id: 'desc' }],
    });

  findBetween = (window: Window) =>
    prisma.centerCheckin.findMany({
      where: { checkInTime: within(window) },
      select: checkinSelect,
      orderBy: [{ checkInTime: 'desc' }, { id: 'desc' }],
    });

  hasBookingOn = async (accountId: string, day: Date) =>
    (await prisma.facilityBooking.count({ where: { accountId, bookingDate: day, status: 'CONFIRMED' } })) > 0;

  hasSessionOn = async (accountId: string, day: Date) =>
    (await prisma.classSession.count({
      where: {
        sessionDate: day,
        status: 'SCHEDULED',
        class: {
          status: 'OPEN',
          deletedAt: null,
          enrollments: { some: { accountId, status: 'ENROLLED' } },
        },
      },
    })) > 0;
}

export default new CheckinRepository();
