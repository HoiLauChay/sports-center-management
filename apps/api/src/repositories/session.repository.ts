import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { sessionSelect } from '~/repositories/class.repository';

const ref = { select: { id: true, name: true } } as const;

const detailSelect = {
  ...sessionSelect,
  class: {
    select: {
      id: true,
      name: true,
      coachId: true,
      coach: { select: { id: true, fullName: true } },
      maxStudents: true,
      course: { select: { sport: ref } },
      _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
    },
  },
} satisfies Prisma.ClassSessionSelect;

export type SessionDetailRow = Prisma.ClassSessionGetPayload<{ select: typeof detailSelect }>;

class SessionRepository {
  findById = (id: string, tx: Prisma.TransactionClient) =>
    tx.classSession.findFirst({
      where: { id, class: { deletedAt: null } },
      select: {
        ...sessionSelect,
        facilityId: true,
        class: {
          select: {
            id: true,
            name: true,
            status: true,
            coachId: true,
            startDate: true,
            endDate: true,
            course: { select: { sportId: true } },
            enrollments: { where: { status: 'ENROLLED' }, select: { accountId: true } },
          },
        },
      },
    });

  findDetail = (id: string) =>
    prisma.classSession.findFirst({ where: { id, class: { deletedAt: null } }, select: detailSelect });

  findOn = (date: string) =>
    prisma.classSession.findMany({
      where: { sessionDate: new Date(date), status: 'SCHEDULED', class: { status: 'OPEN', deletedAt: null } },
      select: detailSelect,
      orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
    });

  update = (id: string, data: Prisma.ClassSessionUncheckedUpdateInput, tx: Prisma.TransactionClient) =>
    tx.classSession.update({ where: { id }, data, select: { ...sessionSelect, facilityId: true } });

  dateBounds = (classId: string, tx: Prisma.TransactionClient) =>
    tx.classSession.aggregate({
      where: { classId, status: 'SCHEDULED' },
      _min: { sessionDate: true },
      _max: { sessionDate: true },
    });
}

export default new SessionRepository();
