import type { ListClassesQuery, Role } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { courseSelect } from '~/repositories/course.repository';
import { pageArgs } from '~/utils/pagination';
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

const classSummarySelect = {
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
  minStudentsOverride: true,
  cancelReason: true,
  _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
} satisfies Prisma.ClassSelect;

const classDetailSelect = {
  ...classSummarySelect,
  sessions: { select: sessionSelect, orderBy: { sessionNumber: 'asc' } },
} satisfies Prisma.ClassSelect;

export type ClassSummaryRow = Prisma.ClassGetPayload<{ select: typeof classSummarySelect }>;
export type ClassViewer = { id: string; role: Role };

export type ClassDetailRow = Prisma.ClassGetPayload<{ select: typeof classDetailSelect }>;
export type ClassSessionRow = ClassDetailRow['sessions'][number];

class ClassRepository {
  // Catalog eligibility needs comparisons across course, coach specialization and enrollment count.
  // Purchased classes are added separately so history remains visible even after cancellation.
  private catalogIds = (today: Date) => prisma.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM classes c
    JOIN courses co ON co.id = c.course_id
    JOIN sports s ON s.id = co.sport_id
    JOIN accounts a ON a.id = c.coach_id
    WHERE c.deleted_at IS NULL AND c.status = 'OPEN' AND c.start_date > ${today}::date
      AND co.deleted_at IS NULL AND s.deleted_at IS NULL AND s.is_active
      AND a.role = 'COACH' AND a.status = 'ACTIVE'
      AND EXISTS (SELECT 1 FROM coach_specializations cs
                  WHERE cs.coach_id = c.coach_id AND cs.sport_id = co.sport_id AND cs.status = 'APPROVED')
      AND EXISTS (SELECT 1 FROM class_sessions cs WHERE cs.class_id = c.id AND cs.status = 'SCHEDULED')
      AND (SELECT count(*) FROM class_enrollments e WHERE e.class_id = c.id AND e.status = 'ENROLLED') < c.max_students
  `;

  private visibility = async (viewer: ClassViewer, today: Date): Promise<Prisma.ClassWhereInput> => {
    if (viewer.role !== 'MEMBER') return { deletedAt: null };
    const ids = await this.catalogIds(today);
    return {
      deletedAt: null,
      OR: [{ id: { in: ids.map(({ id }) => id) } }, { enrollments: { some: { accountId: viewer.id } } }],
    };
  };

  findPage = async (viewer: ClassViewer, query: ListClassesQuery) => {
    const today = new Date(todayInCenter());
    const derived: Prisma.ClassWhereInput = query.derivedStatus
      ? {
          status: 'OPEN',
          startDate: query.derivedStatus === 'UPCOMING' ? { gt: today } : { lte: today },
          endDate: query.derivedStatus === 'COMPLETED' ? { lt: today } : { gte: today },
        }
      : {};
    const where: Prisma.ClassWhereInput = {
      AND: [await this.visibility(viewer, today), derived],
      courseId: query.courseId,
      coachId: query.coachId,
      facilityId: query.facilityId,
      status: query.status,
      course: query.sportId ? { sportId: query.sportId } : undefined,
      ...(query.q && {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { coach: { fullName: { contains: query.q, mode: 'insensitive' } } },
        ],
      }),
    };
    return Promise.all([
      prisma.class.findMany({
        where,
        select: classSummarySelect,
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        ...pageArgs(query),
      }),
      prisma.class.count({ where }),
    ]);
  };

  findVisibleDetail = async (id: string, viewer: ClassViewer) =>
    prisma.class.findFirst({
      where: { id, AND: [await this.visibility(viewer, new Date(todayInCenter()))] },
      select: classDetailSelect,
    });

  update = (id: string, data: Prisma.ClassUncheckedUpdateInput, tx: Prisma.TransactionClient) =>
    tx.class.update({ where: { id }, data, select: classDetailSelect });

  hasApprovedCoach = async (coachId: string, sportId: string, tx: Prisma.TransactionClient) =>
    (await tx.coachSpecialization.count({
      where: { coachId, sportId, status: 'APPROVED', coach: { role: 'COACH', status: 'ACTIVE' } },
    })) > 0;

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
