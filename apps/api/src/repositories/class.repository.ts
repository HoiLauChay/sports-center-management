import type { ClassDerivedStatus, ListClassesQuery, Role } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { courseSelect } from '~/repositories/course.repository';
import { findSegmentedPage, pageArgs, type Segment } from '~/utils/pagination';
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

const person = { select: { id: true, fullName: true } } as const;

export const taughtBy = (coachId: string): Prisma.ClassSessionWhereInput => ({
  OR: [{ coachId }, { coachId: null, class: { coachId } }],
});

export const sessionSelect = {
  id: true,
  classId: true,
  coachId: true,
  coach: person,
  class: { select: { coachId: true, coach: person } },
  sessionNumber: true,
  sessionDate: true,
  startTime: true,
  endTime: true,
  facility: ref,
  status: true,
  cancelReason: true,
} satisfies Prisma.ClassSessionSelect;

export const classSummarySelect = {
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
} satisfies Prisma.ClassSelect;

const classDetailSelect = {
  ...classSummarySelect,
  sessions: { select: sessionSelect, orderBy: { sessionNumber: 'asc' } },
} satisfies Prisma.ClassSelect;

export type ClassSummaryRow = Prisma.ClassGetPayload<{ select: typeof classSummarySelect }>;
export type ClassViewer = { id: string; role: Role };

export type ClassDetailRow = Prisma.ClassGetPayload<{ select: typeof classDetailSelect }>;
export type ClassSessionRow = ClassDetailRow['sessions'][number];

const catalog = (today: Date): Prisma.ClassWhereInput => ({
  status: 'OPEN',
  startDate: { gt: today },
  coachId: { not: null },
  sessions: { some: { status: 'SCHEDULED' } },
});

const needsCoach = (viewer: ClassViewer, today: Date): Prisma.ClassWhereInput => ({
  status: { in: ['DRAFT', 'PENDING_APPROVAL'] },
  coachId: null,
  startDate: { gt: today },
  ...(viewer.role === 'COACH' && {
    course: { sport: { coachSpecializations: { some: { coachId: viewer.id, status: 'APPROVED' } } } },
  }),
});

const visibleTo = (viewer: ClassViewer, today: Date): Prisma.ClassWhereInput => {
  if (viewer.role === 'MANAGER') return {};
  if (viewer.role === 'COACH') return { OR: [{ status: { not: 'DRAFT' } }, needsCoach(viewer, today)] };
  if (viewer.role !== 'MEMBER') return { status: { not: 'DRAFT' } };
  return { OR: [catalog(today), { enrollments: { some: { accountId: viewer.id } } }] };
};

const derivedFilter = (status: ClassDerivedStatus, today: Date): Prisma.ClassWhereInput => ({
  status: 'OPEN',
  startDate: status === 'UPCOMING' ? { gt: today } : { lte: today },
  endDate: status === 'COMPLETED' ? { lt: today } : { gte: today },
});

type ClassSegment = Segment<Prisma.ClassWhereInput, Prisma.ClassOrderByWithRelationInput[]>;

const startAsc: Prisma.ClassOrderByWithRelationInput[] = [{ startDate: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];

const managerSegments = (today: Date): ClassSegment[] => [
  { where: { status: 'PENDING_APPROVAL' }, orderBy: startAsc },
  { where: { status: 'OPEN', OR: [{ endDate: null }, { endDate: { gte: today } }] }, orderBy: startAsc },
  { where: { status: 'DRAFT' }, orderBy: startAsc },
  { where: { status: 'OPEN', endDate: { lt: today } }, orderBy: [{ endDate: 'desc' }, { id: 'desc' }] },
  {
    where: { status: 'CANCELLED' },
    orderBy: [{ startDate: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
  },
];

class ClassRepository {
  findAssignedToCoach = (coachId: string) =>
    prisma.class.findMany({
      where: { coachId, deletedAt: null, status: { not: 'CANCELLED' } },
      select: classSummarySelect,
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
    });

  findStartingOn = (dates: string[], take: number) =>
    prisma.class.findMany({
      where: { status: 'OPEN', deletedAt: null, startDate: { in: dates.map((date) => new Date(date)) } },
      select: {
        id: true,
        minStudents: true,
        _count: { select: { enrollments: { where: { status: 'ENROLLED' } } } },
        sessions: {
          where: { status: 'SCHEDULED' },
          select: { sessionDate: true, startTime: true },
          orderBy: [{ sessionDate: 'asc' }, { startTime: 'asc' }],
          take: 1,
        },
      },
      orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
      take,
    });

  cancelSessions = (ids: string[], reason: string, tx: Prisma.TransactionClient) =>
    tx.classSession.updateMany({
      where: { id: { in: ids }, status: 'SCHEDULED' },
      data: { status: 'CANCELLED', cancelReason: reason },
    });

  findPage = (viewer: ClassViewer, { page, limit, ...query }: ListClassesQuery) => {
    const today = new Date(todayInCenter());
    const where: Prisma.ClassWhereInput = {
      deletedAt: null,
      courseId: query.courseId,
      coachId: query.coachId,
      facilityId: query.facilityId,
      status: query.status,
      ...(query.sportId && { course: { sportId: query.sportId } }),
      AND: [
        visibleTo(viewer, today),
        query.needsCoach ? needsCoach(viewer, today) : {},
        query.openForEnrollment ? catalog(today) : {},
        query.derivedStatus ? derivedFilter(query.derivedStatus, today) : {},
        query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { coach: { fullName: { contains: query.q, mode: 'insensitive' } } },
              ],
            }
          : {},
      ],
    };
    if (viewer.role === 'MANAGER') {
      return findSegmentedPage(
        managerSegments(today),
        { page, limit },
        (segment) => prisma.class.count({ where: { AND: [where, segment] } }),
        ({ where: segment, ...args }) =>
          prisma.class.findMany({ where: { AND: [where, segment] }, select: classSummarySelect, ...args }),
      );
    }
    return Promise.all([
      prisma.class.findMany({
        where,
        select: classSummarySelect,
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        ...pageArgs({ page, limit }),
      }),
      prisma.class.count({ where }),
    ]);
  };

  findVisibleDetail = (id: string, viewer: ClassViewer) =>
    prisma.class.findFirst({
      where: { id, deletedAt: null, AND: [visibleTo(viewer, new Date(todayInCenter()))] },
      select: classDetailSelect,
    });

  update = (id: string, data: Prisma.ClassUncheckedUpdateInput, tx: Prisma.TransactionClient) =>
    tx.class.update({ where: { id }, data, select: classDetailSelect });

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
      data: { coachId: null, status: 'PENDING_APPROVAL', approvedById: null, approvedAt: null },
      select: classSelect,
    });
}

export default new ClassRepository();
