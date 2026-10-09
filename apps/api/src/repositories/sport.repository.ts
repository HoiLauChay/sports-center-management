import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { todayInCenter } from '~/utils/time';

const sportSelect = {
  id: true,
  name: true,
  description: true,
  iconUrl: true,
  isActive: true,
} satisfies Prisma.SportSelect;

export type SportRow = Prisma.SportGetPayload<{ select: typeof sportSelect }>;

class SportRepository {
  findAll = (includeInactive: boolean) =>
    prisma.sport.findMany({
      where: { deletedAt: null, ...(!includeInactive && { isActive: true }) },
      select: sportSelect,
      orderBy: { name: 'asc' },
    });

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.sport.findUnique({ where: { id, deletedAt: null }, select: sportSelect });

  findActiveIds = async (ids: string[], tx: Prisma.TransactionClient = prisma) =>
    (
      await tx.sport.findMany({
        where: { id: { in: ids }, deletedAt: null, isActive: true },
        select: { id: true },
      })
    ).map(({ id }) => id);

  create = (data: Prisma.SportCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.sport.create({ data, select: sportSelect });

  update = (id: string, data: Prisma.SportUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.sport.update({ where: { id }, data, select: sportSelect });

  hasOngoingClasses = async (sportId: string, today: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.class.count({
      where: {
        course: { sportId },
        deletedAt: null,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'OPEN'] },
        startDate: { lte: new Date(today) },
        OR: [{ endDate: null }, { endDate: { gte: new Date(today) } }],
      },
    })) > 0;

  findNotStartedClasses = (sportId: string, today: string, tx: Prisma.TransactionClient = prisma) =>
    tx.class.findMany({
      where: {
        course: { sportId },
        deletedAt: null,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'OPEN'] },
        OR: [{ startDate: null }, { startDate: { gt: new Date(today) } }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        enrollments: {
          where: { status: 'ENROLLED' },
          select: { accountId: true, orderItem: { select: { totalAmount: true, refundedAt: true } } },
        },
      },
      orderBy: { startDate: 'asc' },
    });

  hasUnfinishedClasses = async (sportId: string, tx: Prisma.TransactionClient = prisma) => {
    const today = todayInCenter();
    return (
      (await tx.class.count({
        where: {
          course: { sportId },
          deletedAt: null,
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'OPEN'] },
          OR: [{ endDate: null }, { endDate: { gte: new Date(today) } }],
        },
      })) > 0
    );
  };
}

export default new SportRepository();
