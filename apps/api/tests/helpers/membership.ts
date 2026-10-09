import { prisma } from '~/configs/db';
import { addDays, todayInCenter } from '~/utils/time';

interface Benefits {
  gymAccess?: boolean;
  bookingDiscountPct?: number;
  classDiscountPct?: number;
  freeBookingSlotsPerMonth?: number;
}

let seq = 0;

export const giveActiveMembership = async (accountId: string, benefits: Benefits = {}, endDate?: string) => {
  const values = {
    gymAccess: false,
    bookingDiscountPct: 0,
    classDiscountPct: 0,
    freeBookingSlotsPerMonth: 0,
    ...benefits,
  };
  const lastDay = endDate ?? addDays(todayInCenter(), 30);
  const start = new Date(addDays(lastDay, -31));
  const end = new Date(lastDay);
  const gold = await prisma.membership.create({
    data: { name: `Gold ${++seq}`, price: 500_000, durationDays: 31, ...values },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `DH260901MEMB${String(seq).padStart(2, '0')}`,
      idempotencyKey: `test:membership:${accountId}`,
      accountId,
      receiptSnapshot: { schema_version: 1 },
      subtotal: 500_000,
      totalAmount: 500_000,
      paymentMethod: 'WALLET',
      items: {
        create: {
          lineNumber: 1,
          type: 'MEMBERSHIP',
          itemSnapshot: { schema_version: 1 },
          subtotal: 500_000,
          totalAmount: 500_000,
        },
      },
    },
    include: { items: true },
  });
  await prisma.memberMembership.create({
    data: {
      accountId,
      packageId: gold.id,
      startDate: start,
      endDate: end,
      periods: {
        create: { orderItemId: order.items[0]!.id, periodStart: start, periodEnd: end, ...values },
      },
    },
  });
};
