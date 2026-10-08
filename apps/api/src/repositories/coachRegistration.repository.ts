import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const registrationSelect = {
  id: true,
  classId: true,
  coachId: true,
  coach: { select: { id: true, fullName: true } },
  source: true,
  status: true,
  reviewedById: true,
  reviewedAt: true,
  createdAt: true,
} satisfies Prisma.ClassCoachRegistrationSelect;

export type CoachRegistrationRow = Prisma.ClassCoachRegistrationGetPayload<{ select: typeof registrationSelect }>;

class CoachRegistrationRepository {
  findAll = (classId: string, tx: Prisma.TransactionClient = prisma) =>
    tx.classCoachRegistration.findMany({
      where: { classId },
      select: registrationSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

  findPending = (classId: string, tx: Prisma.TransactionClient) =>
    tx.classCoachRegistration.findMany({
      where: { classId, status: 'PENDING' },
      select: registrationSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

  findInClass = (id: string, classId: string, tx: Prisma.TransactionClient) =>
    tx.classCoachRegistration.findFirst({ where: { id, classId }, select: registrationSelect });

  hasPending = async (classId: string, coachId: string, tx: Prisma.TransactionClient) =>
    (await tx.classCoachRegistration.count({ where: { classId, coachId, status: 'PENDING' } })) > 0;

  create = (data: Prisma.ClassCoachRegistrationUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.classCoachRegistration.create({ data, select: registrationSelect });

  review = (id: string, status: 'APPROVED' | 'REJECTED', managerId: string, tx: Prisma.TransactionClient) =>
    tx.classCoachRegistration.update({
      where: { id, status: 'PENDING' },
      data: { status, reviewedById: managerId, reviewedAt: new Date() },
      select: registrationSelect,
    });
}

export default new CoachRegistrationRepository();
