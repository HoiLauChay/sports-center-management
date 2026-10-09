import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { classSummarySelect } from '~/repositories/class.repository';
import { todayInCenter } from '~/utils/time';

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
  findByAccount = (accountId: string) =>
    prisma.classEnrollment.findMany({
      where: { accountId },
      select: { ...enrollmentSelect, class: { select: classSummarySelect } },
      orderBy: [{ enrolledAt: 'desc' }, { id: 'desc' }],
    });

  findByClass = (classId: string) =>
    prisma.classEnrollment.findMany({
      where: { classId },
      select: enrollmentSelect,
      orderBy: [{ enrolledAt: 'asc' }, { id: 'asc' }],
    });

  hasCurrentStudent = async (coachId: string, accountId: string) =>
    (await prisma.classEnrollment.count({
      where: {
        accountId,
        status: 'ENROLLED',
        account: { role: 'MEMBER' },
        class: { coachId, status: 'OPEN', deletedAt: null, endDate: { gte: new Date(todayInCenter()) } },
      },
    })) > 0;

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.classEnrollment.findUnique({ where: { id }, select: enrollmentSelect });

  findActiveByClass = (classId: string, tx: Prisma.TransactionClient) =>
    tx.classEnrollment.findMany({
      where: { classId, status: 'ENROLLED' },
      select: { id: true, accountId: true, orderItemId: true },
    });

  hasActive = async (classId: string, accountId: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.classEnrollment.count({ where: { classId, accountId, status: 'ENROLLED' } })) > 0;

  create = (data: Prisma.ClassEnrollmentUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.classEnrollment.create({ data, select: { id: true } });

  cancel = (id: string, tx: Prisma.TransactionClient) =>
    tx.classEnrollment.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
}

export default new EnrollmentRepository();
