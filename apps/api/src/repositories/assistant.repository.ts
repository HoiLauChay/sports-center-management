import { prisma } from '~/configs/db';
import { Prisma } from '~/generated/prisma/client';

/** What the AI assistant reads, and the questions it counts. Every query is scoped to the asking account. */
class AssistantRepository {
  findUsage = (accountId: string, period: string) =>
    prisma.assistantUsage.findUnique({ where: { accountId_period: { accountId, period } }, select: { count: true } });

  /**
   * Counts one more question in `period` unless `limit` is already reached, in one statement so two tabs asking at
   * once cannot both pass the last free question. Returns the new count, or null when the limit was reached.
   */
  consumeQuestion = async (accountId: string, period: string, limit: number) => {
    const [row] = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      INSERT INTO assistant_usages (account_id, period, count, updated_at)
      VALUES (${accountId}::uuid, ${period}, 1, now())
      ON CONFLICT (account_id, period) DO UPDATE SET count = assistant_usages.count + 1, updated_at = now()
      WHERE assistant_usages.count < ${limit}
      RETURNING count
    `);
    return row?.count ?? null;
  };

  /** Gives back a question that got no answer. */
  refundQuestion = (accountId: string, period: string) =>
    prisma.assistantUsage.updateMany({
      where: { accountId, period, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });

  /** What the attendance card names a session by; the caller has already checked the coach teaches it. */
  findSessionLabel = (sessionId: string) =>
    prisma.classSession.findUnique({
      where: { id: sessionId },
      select: { sessionNumber: true, sessionDate: true, startTime: true, class: { select: { name: true } } },
    });

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
