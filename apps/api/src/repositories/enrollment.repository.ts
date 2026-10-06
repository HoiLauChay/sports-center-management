import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

class EnrollmentRepository {
  hasActive = async (classId: string, accountId: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.classEnrollment.count({ where: { classId, accountId, status: 'ENROLLED' } })) > 0;

  create = (data: Prisma.ClassEnrollmentUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.classEnrollment.create({ data, select: { id: true } });
}

export default new EnrollmentRepository();
