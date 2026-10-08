import type { Prisma } from '~/generated/prisma/client';
import { sessionSelect } from '~/repositories/class.repository';

class SessionRepository {
  findById = (id: string, tx: Prisma.TransactionClient) =>
    tx.classSession.findFirst({
      where: { id, class: { deletedAt: null } },
      include: {
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
