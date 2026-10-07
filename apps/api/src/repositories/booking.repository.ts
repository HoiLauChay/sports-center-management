import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

class BookingRepository {
  findFreeSlotTimes = (accountId: string, from: string, to: string, tx: Prisma.TransactionClient = prisma) =>
    tx.facilityBooking.findMany({
      where: {
        accountId,
        status: 'CONFIRMED',
        benefit: 'FREE_SLOT',
        bookingDate: { gte: new Date(from), lt: new Date(to) },
      },
      select: { startTime: true, endTime: true },
    });

  create = (data: Prisma.FacilityBookingUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.facilityBooking.create({ data, select: { id: true } });

  createPackage = (data: Prisma.FacilityPackageUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.facilityPackage.create({ data, select: { id: true } });
}

export default new BookingRepository();
