import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { fromDbTime } from '~/utils/time';

class BookingRepository {
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
