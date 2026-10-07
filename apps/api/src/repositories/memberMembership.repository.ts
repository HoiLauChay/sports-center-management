import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const memberMembershipSelect = {
  id: true,
  accountId: true,
  packageId: true,
  package: { select: { id: true, name: true, isActive: true, deletedAt: true } },
  status: true,
  startDate: true,
  endDate: true,
  autoRenew: true,
  cancelledAt: true,
  periods: {
    select: {
      orderItemId: true,
      periodStart: true,
      periodEnd: true,
      gymAccess: true,
      bookingDiscountPct: true,
      classDiscountPct: true,
      freeBookingSlotsPerMonth: true,
      orderItem: { select: { totalAmount: true } },
    },
    orderBy: { periodStart: 'asc' },
  },
} satisfies Prisma.MemberMembershipSelect;

export type MemberMembershipRow = Prisma.MemberMembershipGetPayload<{ select: typeof memberMembershipSelect }>;

class MemberMembershipRepository {
  findMine = (accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberMembership.findMany({
      where: { accountId },
      select: memberMembershipSelect,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

  findById = (id: string, accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberMembership.findUnique({ where: { id, accountId }, select: memberMembershipSelect });

  update = (id: string, data: Prisma.MemberMembershipUpdateInput, tx: Prisma.TransactionClient) =>
    tx.memberMembership.update({ where: { id }, data, select: memberMembershipSelect });
}

export default new MemberMembershipRepository();
