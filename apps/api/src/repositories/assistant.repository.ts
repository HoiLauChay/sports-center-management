import { prisma } from '~/configs/db';

/** A member's own training data, read for the AI assistant. Every query is scoped to that member. */
class AssistantRepository {
  /** Classes the member is enrolled in right now, optionally just one. */
  findEnrolledClasses = (accountId: string, classId?: string) =>
    prisma.classEnrollment.findMany({
      where: { accountId, status: 'ENROLLED', classId, class: { deletedAt: null } },
      select: { class: { select: { id: true, name: true } } },
      orderBy: { enrolledAt: 'desc' },
    });

  countAttendance = (accountId: string, classIds: string[]) =>
    prisma.classAttendance.groupBy({
      by: ['status'],
      where: { accountId, session: { classId: { in: classIds }, status: 'SCHEDULED' } },
      _count: true,
    });

  findRecentResults = (accountId: string, classIds: string[], take: number) =>
    prisma.memberEvaluation.findMany({
      where: { accountId, deletedAt: null, session: { classId: { in: classIds } } },
      select: {
        rating: true,
        comment: true,
        session: { select: { sessionNumber: true, sessionDate: true, class: { select: { name: true } } } },
      },
      orderBy: [{ session: { sessionDate: 'desc' } }, { session: { startTime: 'desc' } }],
      take,
    });

  /** The coach's notes on sessions that already took place, newest first. */
  findSessionNotes = (classIds: string[], until: Date, take: number) =>
    prisma.classSession.findMany({
      where: {
        classId: { in: classIds },
        status: 'SCHEDULED',
        sessionDate: { lte: until },
        OR: [{ noteHomework: { not: null } }, { noteContent: { not: null } }],
      },
      select: {
        sessionNumber: true,
        sessionDate: true,
        noteTitle: true,
        noteContent: true,
        noteHomework: true,
        class: { select: { id: true, name: true } },
      },
      orderBy: [{ sessionDate: 'desc' }, { startTime: 'desc' }],
      take,
    });
}

export default new AssistantRepository();
