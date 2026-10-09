import type { ListBookingsQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';
import { fromDbTime } from '~/utils/time';

const bookingSelect = {
  id: true,
  facility: { select: { id: true, name: true } },
  account: { select: { id: true, fullName: true } },
  bookingDate: true,
  startTime: true,
  endTime: true,
  status: true,
  unitPrice: true,
  benefit: true,
  packageId: true,
  orderItemId: true,
  createdAt: true,
  orderItem: { select: { totalAmount: true, order: { select: { guestName: true, guestPhone: true } } } },
} satisfies Prisma.FacilityBookingSelect;

const packageSelect = {
  id: true,
  facility: { select: { id: true, name: true } },
  startDate: true,
  endDate: true,
  daysOfWeek: true,
  startTime: true,
  endTime: true,
  status: true,
  unitPrice: true,
  bookings: { select: bookingSelect, orderBy: [{ bookingDate: 'asc' }, { startTime: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.FacilityPackageSelect;

export type BookingRow = Prisma.FacilityBookingGetPayload<{ select: typeof bookingSelect }>;
export type FacilityPackageRow = Prisma.FacilityPackageGetPayload<{ select: typeof packageSelect }>;

class BookingRepository {
  findPage = ({ page, limit, ...query }: ListBookingsQuery) => {
    const where: Prisma.FacilityBookingWhereInput = {
      accountId: query.accountId,
      facilityId: query.facilityId,
      status: query.status,
      AND: [
        {
          bookingDate: {
            gte: query.from ? new Date(query.from) : undefined,
            lte: query.to ? new Date(query.to) : undefined,
          },
        },
        query.date ? { bookingDate: new Date(query.date) } : {},
        query.guestPhone ? { accountId: null, orderItem: { order: { guestPhone: query.guestPhone } } } : {},
      ],
    };
    return Promise.all([
      prisma.facilityBooking.findMany({
        where,
        select: bookingSelect,
        orderBy: [{ bookingDate: 'desc' }, { startTime: 'desc' }, { id: 'desc' }],
        ...pageArgs({ page, limit }),
      }),
      prisma.facilityBooking.count({ where }),
    ]);
  };

  findById = (id: string) => prisma.facilityBooking.findUnique({ where: { id }, select: bookingSelect });

  findPackagesByAccount = (accountId: string) =>
    prisma.facilityPackage.findMany({
      where: { accountId },
      select: packageSelect,
      orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    });

  countFreeSlots = async (
    accountId: string,
    { from, to }: { from: string; to: string },
    slotMinutes: number,
    tx: Prisma.TransactionClient = prisma,
  ) => {
    const bookings = await tx.facilityBooking.findMany({
      where: {
        accountId,
        status: 'CONFIRMED',
        benefit: 'FREE_SLOT',
        bookingDate: { gte: new Date(from), lt: new Date(to) },
      },
      select: { startTime: true, endTime: true },
    });
    return bookings.reduce(
      (sum, { startTime, endTime }) => sum + (fromDbTime(endTime) - fromDbTime(startTime)) / slotMinutes,
      0,
    );
  };

  create = (data: Prisma.FacilityBookingUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.facilityBooking.create({ data, select: { id: true } });

  createPackage = (data: Prisma.FacilityPackageUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.facilityPackage.create({ data, select: { id: true } });
}

export default new BookingRepository();
