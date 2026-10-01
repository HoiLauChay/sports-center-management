import type { ListSpecializationsQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { pageArgs } from '~/utils/pagination';

const specializationSelect = {
  id: true,
  coachId: true,
  coach: { select: { fullName: true } },
  sportId: true,
  sport: { select: { name: true } },
  status: true,
  reviewNote: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.CoachSpecializationSelect;

export type SpecializationRow = Prisma.CoachSpecializationGetPayload<{ select: typeof specializationSelect }>;

class SpecializationRepository {
  findAll = (coachId: string) =>
    prisma.coachSpecialization.findMany({
      where: { coachId },
      select: specializationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });

  findPage = ({ status, coachId, sportId, ...page }: ListSpecializationsQuery) => {
    const where: Prisma.CoachSpecializationWhereInput = { status, coachId, sportId };
    return Promise.all([
      prisma.coachSpecialization.findMany({
        where,
        select: specializationSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...pageArgs(page),
      }),
      prisma.coachSpecialization.count({ where }),
    ]);
  };

  lockSport = async (sportId: string, tx: Prisma.TransactionClient) => {
    const [sport] = await tx.$queryRaw<{ isActive: boolean; deletedAt: Date | null }[]>`
      SELECT is_active AS "isActive", deleted_at AS "deletedAt"
      FROM sports WHERE id = ${sportId}::uuid FOR SHARE
    `;
    return sport;
  };

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.coachSpecialization.findUnique({ where: { id }, select: specializationSelect });

  findExisting = (coachId: string, sportId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.coachSpecialization.findFirst({
      where: { coachId, sportId, status: { in: ['PENDING', 'APPROVED'] } },
      select: { id: true },
    });

  create = (coachId: string, sportId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.coachSpecialization.create({
      data: { coachId, sportId },
      select: specializationSelect,
    });

  review = async (
    id: string,
    data: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null; reviewedById: string },
    tx: Prisma.TransactionClient = prisma,
  ) => {
    const { count } = await tx.coachSpecialization.updateMany({
      where: { id, status: 'PENDING' },
      data: { ...data, reviewedAt: new Date() },
    });
    return count === 0 ? null : this.findById(id, tx);
  };
}

export default new SpecializationRepository();
