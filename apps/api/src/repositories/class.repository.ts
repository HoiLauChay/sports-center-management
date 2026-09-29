import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { todayInCenter } from '~/utils/time';

const classSelect = {
  id: true,
  name: true,
  courseId: true,
  coachId: true,
  facilityId: true,
  minStudents: true,
  minStudentsOverride: true,
  maxStudents: true,
  startDate: true,
  endDate: true,
  weeklySchedule: true,
  status: true,
  cancelReason: true,
  deletedAt: true,
} satisfies Prisma.ClassSelect;

class ClassRepository {
  hasInProgressForCoach = async (coachId: string, tx: Prisma.TransactionClient = prisma) => {
    const today = new Date(todayInCenter());
    return (
      (await tx.class.count({
        where: {
          coachId,
          deletedAt: null,
          status: 'OPEN',
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
      })) > 0
    );
  };

  findNotStartedForCoach = (coachId: string, tx: Prisma.TransactionClient = prisma) => {
    const today = new Date(todayInCenter());
    return tx.class.findMany({
      where: {
        coachId,
        deletedAt: null,
        status: { in: ['OPEN', 'PENDING_APPROVAL'] },
        OR: [{ startDate: null }, { startDate: { gt: today } }],
      },
      select: { ...classSelect, enrollments: { where: { status: 'ENROLLED' }, select: { accountId: true } } },
    });
  };

  unassignCoach = (ids: string[], tx: Prisma.TransactionClient = prisma) =>
    tx.class.updateManyAndReturn({
      where: { id: { in: ids } },
      data: { coachId: null, status: 'PENDING_APPROVAL' },
      select: classSelect,
    });
}

export default new ClassRepository();
