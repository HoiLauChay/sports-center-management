import type { ListSupportQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';

const person = { select: { id: true, fullName: true } } as const;
const supportSelect = {
  id: true,
  account: person,
  handledBy: person,
  category: true,
  subject: true,
  description: true,
  status: true,
  resolutionNote: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupportRequestSelect;

export type SupportRow = Prisma.SupportRequestGetPayload<{ select: typeof supportSelect }>;

class SupportRepository {
  create = (data: Prisma.SupportRequestUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.supportRequest.create({ data, select: supportSelect });

  findMine = (accountId: string) =>
    prisma.supportRequest.findMany({
      where: { accountId, deletedAt: null },
      select: supportSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

  findPage = ({ page, limit, status, category, q }: ListSupportQuery) => {
    const where: Prisma.SupportRequestWhereInput = {
      deletedAt: null,
      status,
      category,
      ...(q && {
        OR: [
          { subject: { contains: q, mode: 'insensitive' } },
          { account: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      }),
    };
    return Promise.all([
      prisma.supportRequest.findMany({
        where,
        select: supportSelect,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        ...pageArgs({ page, limit }),
      }),
      prisma.supportRequest.count({ where }),
    ]);
  };

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.supportRequest.findUnique({ where: { id, deletedAt: null }, select: supportSelect });

  update = (id: string, data: Prisma.SupportRequestUncheckedUpdateInput, tx: Prisma.TransactionClient) =>
    tx.supportRequest.update({ where: { id }, data, select: supportSelect });
}

export default new SupportRepository();
