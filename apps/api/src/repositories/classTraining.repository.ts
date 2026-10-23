import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

const person = { select: { id: true, fullName: true } } as const;

const announcementSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  sender: person,
  createdAt: true,
} satisfies Prisma.ClassAnnouncementSelect;

export type AnnouncementRow = Prisma.ClassAnnouncementGetPayload<{ select: typeof announcementSelect }>;

class ClassTrainingRepository {
  createAnnouncement = (data: Prisma.ClassAnnouncementUncheckedCreateInput, tx: Prisma.TransactionClient) =>
    tx.classAnnouncement.create({ data, select: announcementSelect });

  findAnnouncements = (classId: string) =>
    prisma.classAnnouncement.findMany({
      where: { classId },
      select: announcementSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
}

export default new ClassTrainingRepository();
