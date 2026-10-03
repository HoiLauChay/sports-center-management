import { prisma } from '~/configs/db';
import { parseTime, toDbTime } from '~/utils/time';
import { createAccount } from './http';

export const SEED_DAY = '2026-10-20';

let seq = 0;

export const seedFacility = (capacityPerSlot: number, data: Record<string, unknown> = {}) =>
  prisma.facility.create({
    data: { name: `Sân ${++seq}`, type: 'COURT', capacityPerSlot, pricePerSlot: 100_000, ...data },
  });

export const seedBooking = async (
  facilityId: string,
  start: string,
  end: string,
  { date = SEED_DAY, accountId }: { date?: string; accountId?: string } = {},
) => {
  const order = await prisma.order.create({
    data: {
      orderNumber: `DH261020TEST${String(++seq).padStart(2, '0')}`,
      idempotencyKey: `test:schedule:${seq}`,
      accountId: accountId ?? null,
      guestName: accountId ? null : 'Khách',
      guestPhone: accountId ? null : '0901234567',
      createdById: accountId ? null : (await createAccount('RECEPTIONIST', `r${seq}@example.com`)).id,
      receiptSnapshot: { schema_version: 1 },
      subtotal: 0,
      totalAmount: 0,
      paymentMethod: 'CASH',
      items: {
        create: {
          lineNumber: 1,
          type: 'FACILITY_BOOKING',
          itemSnapshot: { schema_version: 1 },
          subtotal: 0,
          totalAmount: 0,
        },
      },
    },
    include: { items: true },
  });
  return prisma.facilityBooking.create({
    data: {
      facilityId,
      accountId: accountId ?? null,
      orderItemId: order.items[0]!.id,
      bookingDate: new Date(date),
      startTime: toDbTime(parseTime(start)),
      endTime: toDbTime(parseTime(end)),
      unitPrice: 0,
    },
  });
};

export const seedSession = async (
  facilityId: string,
  start: string,
  end: string,
  { date = SEED_DAY, coachId }: { date?: string; coachId?: string } = {},
) => {
  const sport = await prisma.sport.create({ data: { name: `Môn ${++seq}` } });
  const course = await prisma.course.create({ data: { name: 'Khóa', sportId: sport.id, totalSessions: 1, price: 0 } });
  const cls = await prisma.class.create({
    data: { name: `Lớp ${seq}`, courseId: course.id, facilityId, coachId, maxStudents: 10, weeklySchedule: [] },
  });
  return prisma.classSession.create({
    data: {
      classId: cls.id,
      facilityId,
      sessionNumber: 1,
      sessionDate: new Date(date),
      startTime: toDbTime(parseTime(start)),
      endTime: toDbTime(parseTime(end)),
    },
    include: { class: true },
  });
};
