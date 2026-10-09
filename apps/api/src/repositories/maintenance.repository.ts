import type { ListMaintenancesQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { addDays, toCenterDateTime, todayInCenter } from '~/utils/time';

const ref = { select: { id: true, name: true } } as const;

const maintenanceSelect = {
  id: true,
  facility: ref,
  startAt: true,
  endAt: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.FacilityMaintenanceSelect;

const affectedBookingSelect = {
  id: true,
  bookingDate: true,
  startTime: true,
  endTime: true,
  packageId: true,
  account: { select: { id: true, fullName: true } },
  orderItem: { select: { order: { select: { guestName: true } } } },
} satisfies Prisma.FacilityBookingSelect;

const affectedSessionSelect = {
  id: true,
  classId: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  class: { select: { id: true, name: true, coachId: true, course: { select: { sportId: true } } } },
} satisfies Prisma.ClassSessionSelect;

export type MaintenanceRow = Prisma.FacilityMaintenanceGetPayload<{ select: typeof maintenanceSelect }>;
export type AffectedBookingRow = Prisma.FacilityBookingGetPayload<{ select: typeof affectedBookingSelect }>;
export type AffectedSessionRow = Prisma.ClassSessionGetPayload<{ select: typeof affectedSessionSelect }>;

const daysOf = (startAt: Date, endAt: Date) => ({
  gte: new Date(todayInCenter(startAt)),
  lte: new Date(todayInCenter(endAt)),
});

class MaintenanceRepository {
  findMany = ({ facilityId, from, to }: ListMaintenancesQuery) =>
    prisma.facilityMaintenance.findMany({
      where: {
        facilityId,
        deletedAt: null,
        endAt: from ? { gt: toCenterDateTime(from, 0) } : undefined,
        startAt: to ? { lt: toCenterDateTime(addDays(to, 1), 0) } : undefined,
      },
      select: maintenanceSelect,
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    });

  findBookingsBetween = (facilityId: string, startAt: Date, endAt: Date, tx: Prisma.TransactionClient = prisma) =>
    tx.facilityBooking.findMany({
      where: { facilityId, status: 'CONFIRMED', bookingDate: daysOf(startAt, endAt) },
      select: affectedBookingSelect,
      orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });

  findSessionsBetween = (facilityId: string, startAt: Date, endAt: Date, tx: Prisma.TransactionClient = prisma) =>
    tx.classSession.findMany({
      where: {
        facilityId,
        status: 'SCHEDULED',
        sessionDate: daysOf(startAt, endAt),
        class: { deletedAt: null, status: { not: 'CANCELLED' } },
      },
      select: affectedSessionSelect,
      orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }],
    });

  findFacilitiesForSports = (sportIds: string[], excludeId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.facility.findMany({
      where: {
        id: { not: excludeId },
        isActive: true,
        deletedAt: null,
        sports: { some: { sportId: { in: sportIds } } },
      },
      select: { id: true, name: true, sports: { select: { sportId: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
}

export default new MaintenanceRepository();
