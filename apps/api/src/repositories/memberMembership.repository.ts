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
  findActivePeriods = (accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.membershipOrder.findMany({
      where: { membership: { accountId, status: 'ACTIVE' } },
      select: {
        periodStart: true,
        periodEnd: true,
        gymAccess: true,
        bookingDiscountPct: true,
        classDiscountPct: true,
        freeBookingSlotsPerMonth: true,
        membership: { select: { package: { select: { name: true } } } },
      },
      orderBy: { periodStart: 'asc' },
    });

  findAutoRenewAccountIds = (packageId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberMembership
      .findMany({
        where: { packageId, status: 'ACTIVE', autoRenew: true },
        select: { accountId: true },
      })
      .then((rows) => rows.map(({ accountId }) => accountId));

  findByAccount = (accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberMembership.findMany({
      where: { accountId },
      select: memberMembershipSelect,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });

  findById = (id: string, accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberMembership.findUnique({ where: { id, accountId }, select: memberMembershipSelect });

  findDueIds = (today: string, take: number) =>
    prisma.memberMembership.findMany({
      where: { status: 'ACTIVE', endDate: { lte: new Date(today) } },
      select: { id: true, accountId: true },
      orderBy: { endDate: 'asc' },
      take,
    });

  countDue = (today: string) =>
    prisma.memberMembership.count({ where: { status: 'ACTIVE', endDate: { lte: new Date(today) } } });

  findForJob = (id: string, tx: Prisma.TransactionClient) =>
    tx.memberMembership.findUnique({
      where: { id },
      select: {
        id: true,
        accountId: true,
        packageId: true,
        status: true,
        endDate: true,
        autoRenew: true,
        cancelledAt: true,
        package: { select: { name: true } },
      },
    });

  findExpiring = (today: string, lastDay: string, take: number) =>
    prisma.memberMembership.findMany({
      where: { status: 'ACTIVE', endDate: { gt: new Date(today), lte: new Date(lastDay) } },
      select: {
        id: true,
        accountId: true,
        endDate: true,
        autoRenew: true,
        cancelledAt: true,
        package: { select: { name: true, price: true } },
      },
      take,
    });

  findActive = (accountId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.memberMembership.findFirst({
      where: { accountId, status: 'ACTIVE' },
      select: { id: true, packageId: true, endDate: true },
    });

  create = (data: Prisma.MemberMembershipUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.memberMembership.create({ data, select: { id: true } });

  addPeriod = (data: Prisma.MembershipOrderUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.membershipOrder.create({ data, select: { id: true } });

  update = (id: string, data: Prisma.MemberMembershipUpdateInput, tx: Prisma.TransactionClient) =>
    tx.memberMembership.update({ where: { id }, data, select: memberMembershipSelect });
}

export default new MemberMembershipRepository();
