import type { ListNotificationsQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { cursorArgs } from '~/utils/pagination';

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  referenceType: true,
  referenceId: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof notificationSelect }>;

class NotificationRepository {
  createMany = (data: Prisma.NotificationCreateManyInput[], tx: Prisma.TransactionClient = prisma) =>
    tx.notification.createManyAndReturn({ data, skipDuplicates: true, select: { id: true, sendEmail: true } });

  findPendingEmails = (where: Prisma.NotificationWhereInput, take: number) =>
    prisma.notification.findMany({
      where: { ...where, sendEmail: true, emailSentAt: null },
      select: { id: true, title: true, message: true, account: { select: { email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
      take,
    });

  countPendingEmails = (where: Prisma.NotificationWhereInput) =>
    prisma.notification.count({ where: { ...where, sendEmail: true, emailSentAt: null } });

  markEmailSent = (ids: string[]) =>
    prisma.notification.updateMany({
      where: { id: { in: ids }, emailSentAt: null },
      data: { emailSentAt: new Date() },
    });

  findPage = (accountId: string, { unreadOnly, ...cursor }: ListNotificationsQuery) =>
    prisma.notification.findMany({
      where: { accountId, ...(unreadOnly && { readAt: null }) },
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(cursor),
    });

  countUnread = (accountId: string) => prisma.notification.count({ where: { accountId, readAt: null } });
}

export default new NotificationRepository();
