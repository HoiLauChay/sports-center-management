import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

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
  findAll = (coachId?: string) =>
    prisma.coachSpecialization.findMany({
      where: coachId ? { coachId } : undefined,
      select: specializationSelect,
      orderBy: { createdAt: 'desc' },
    });

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

  review = (
    id: string,
    data: { status: 'APPROVED' | 'REJECTED'; reviewNote?: string | null; reviewedById: string },
    tx: Prisma.TransactionClient = prisma,
  ) =>
    tx.coachSpecialization.update({
      where: { id },
      data: { ...data, reviewedAt: new Date() },
      select: specializationSelect,
    });
}

export default new SpecializationRepository();
