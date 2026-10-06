import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const enrollmentSelect = {
  id: true,
  classId: true,
  accountId: true,
  class: { select: { id: true, name: true, startDate: true } },
  account: { select: { id: true, fullName: true } },
  status: true,
  orderItemId: true,
  orderItem: { select: { totalAmount: true, refundedAt: true } },
  enrolledAt: true,
} satisfies Prisma.ClassEnrollmentSelect;

export type EnrollmentRow = Prisma.ClassEnrollmentGetPayload<{ select: typeof enrollmentSelect }>;

class EnrollmentRepository {
  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.classEnrollment.findUnique({ where: { id }, select: enrollmentSelect });

  hasActive = async (classId: string, accountId: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.classEnrollment.count({ where: { classId, accountId, status: 'ENROLLED' } })) > 0;

  create = (data: Prisma.ClassEnrollmentUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.classEnrollment.create({ data, select: { id: true } });

  cancel = (id: string, tx: Prisma.TransactionClient) =>
    tx.classEnrollment.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
}

export default new EnrollmentRepository();
