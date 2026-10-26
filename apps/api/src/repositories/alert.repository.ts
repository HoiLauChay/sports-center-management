import { prisma } from '~/configs/db';

const classRef = { select: { id: true, name: true, coachId: true } } as const;

/** Reads behind the hourly staff and coach alerts; each one is a backlog the alert reminds someone about. */
class AlertRepository {
  findUnmarkedSessions = (from: Date, to: Date) =>
    prisma.classSession.findMany({
      where: {
        status: 'SCHEDULED',
        sessionDate: { gte: from, lte: to },
        attendances: { none: { updatedById: { not: null } } },
        class: { deletedAt: null, status: 'OPEN', enrollments: { some: { status: 'ENROLLED' } } },
      },
      select: { id: true, sessionDate: true, endTime: true, coachId: true, class: classRef },
    });

  findClassesInProgress = (from: Date, to: Date) =>
    prisma.class.findMany({
      where: {
        deletedAt: null,
        status: 'OPEN',
        coachId: { not: null },
        startDate: { lte: to },
        endDate: { gte: from },
      },
      select: {
        id: true,
        name: true,
        coachId: true,
        sessions: { select: { status: true, sessionDate: true, startTime: true }, orderBy: { sessionDate: 'asc' } },
        enrollments: { where: { status: 'ENROLLED' }, select: { accountId: true } },
        progressReviews: { select: { accountId: true, milestone: true } },
      },
    });

  findClassesStartingBetween = (from: Date, to: Date) =>
    prisma.class.findMany({
      where: {
        deletedAt: null,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'OPEN'] },
        startDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        name: true,
        status: true,
        coachId: true,
        minStudents: true,
        startDate: true,
        _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
      },
    });

  findMaintenancesStartingBetween = (from: Date, to: Date) =>
    prisma.facilityMaintenance.findMany({
      where: { deletedAt: null, startAt: { gte: from, lt: to } },
      select: { id: true, startAt: true, endAt: true, reason: true, facility: { select: { name: true } } },
    });

  countBacklog = async (today: Date) => {
    const [support, bank, specializations, registrations, classesWithoutCoach] = await Promise.all([
      prisma.supportRequest.count({ where: { status: 'OPEN', deletedAt: null } }),
      prisma.bankTransaction.count({ where: { status: 'UNMATCHED' } }),
      prisma.coachSpecialization.count({ where: { status: 'PENDING' } }),
      prisma.classCoachRegistration.count({ where: { status: 'PENDING' } }),
      prisma.class.count({
        where: {
          deletedAt: null,
          coachId: null,
          status: { in: ['DRAFT', 'PENDING_APPROVAL'] },
          OR: [{ startDate: null }, { startDate: { gte: today } }],
        },
      }),
    ]);
    return { support, bank, specializations, registrations, classesWithoutCoach };
  };
}

export default new AlertRepository();
