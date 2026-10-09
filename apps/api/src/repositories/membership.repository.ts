import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const membershipSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  durationDays: true,
  gymAccess: true,
  bookingDiscountPct: true,
  classDiscountPct: true,
  freeBookingSlotsPerMonth: true,
  isActive: true,
} satisfies Prisma.MembershipSelect;

export type MembershipRow = Prisma.MembershipGetPayload<{ select: typeof membershipSelect }>;

class MembershipRepository {
  findAll = (includeInactive: boolean) =>
    prisma.membership.findMany({
      where: { deletedAt: null, ...(!includeInactive && { isActive: true }) },
      select: membershipSelect,
      orderBy: { name: 'asc' },
    });

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.membership.findUnique({ where: { id, deletedAt: null }, select: membershipSelect });

  create = (data: Prisma.MembershipCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.membership.create({ data, select: membershipSelect });

  update = (id: string, data: Prisma.MembershipUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.membership.update({ where: { id }, data, select: membershipSelect });
}

export default new MembershipRepository();
