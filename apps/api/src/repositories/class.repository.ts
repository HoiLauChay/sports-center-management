import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { courseSelect } from '~/repositories/course.repository';
import { todayInCenter } from '~/utils/time';

const classSelect = {
  id: true,
  name: true,
  courseId: true,
  coachId: true,
  facilityId: true,
  minStudents: true,
  maxStudents: true,
  startDate: true,
  endDate: true,
  weeklySchedule: true,
  status: true,
  cancelReason: true,
  deletedAt: true,
} satisfies Prisma.ClassSelect;

const ref = { select: { id: true, name: true } } as const;

const sessionSelect = {
  id: true,
  classId: true,
  sessionNumber: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  facility: ref,
  status: true,
  cancelReason: true,
} satisfies Prisma.ClassSessionSelect;

const classDetailSelect = {
  id: true,
  name: true,
  courseId: true,
  course: { select: courseSelect },
  facilityId: true,
  coachId: true,
  status: true,
  startDate: true,
  endDate: true,
  weeklySchedule: true,
  facility: ref,
  coach: { select: { id: true, fullName: true } },
  minStudents: true,
  maxStudents: true,
  cancelReason: true,
  _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
  sessions: { select: sessionSelect, orderBy: { sessionNumber: 'asc' } },
} satisfies Prisma.ClassSelect;

export type ClassDetailRow = Prisma.ClassGetPayload<{ select: typeof classDetailSelect }>;
export type ClassSessionRow = ClassDetailRow['sessions'][number];

class ClassRepository {
  findDetail = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.class.findUnique({ where: { id, deletedAt: null }, select: classDetailSelect });

  create = (data: Prisma.ClassUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.class.create({ data, select: classDetailSelect });

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
