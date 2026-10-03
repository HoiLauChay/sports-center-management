import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const courseSelect = {
  id: true,
  name: true,
  sportId: true,
  description: true,
  totalSessions: true,
  price: true,
  thumbnailUrl: true,
  deletedAt: true,
  sport: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.CourseSelect;

export type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSelect }>;

class CourseRepository {
  findAll = (includeInactiveSports: boolean) =>
    prisma.course.findMany({
      where: { deletedAt: null, ...(!includeInactiveSports && { sport: { isActive: true, deletedAt: null } }) },
      select: courseSelect,
      orderBy: { name: 'asc' },
    });

  findById = (id: string, tx: Prisma.TransactionClient = prisma) =>
    tx.course.findUnique({
      where: { id, deletedAt: null },
      select: courseSelect,
    });

  hasClasses = async (courseId: string, tx: Prisma.TransactionClient = prisma) =>
    (await tx.class.count({ where: { courseId, deletedAt: null } })) > 0;

  create = (data: Prisma.CourseUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.course.create({
      data,
      select: courseSelect,
    });

  update = (id: string, data: Prisma.CourseUncheckedUpdateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.course.update({
      where: { id },
      data,
      select: courseSelect,
    });
}

export default new CourseRepository();
