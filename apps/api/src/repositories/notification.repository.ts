import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

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

  markEmailSent = (ids: string[]) =>
    prisma.notification.updateMany({
      where: { id: { in: ids }, emailSentAt: null },
      data: { emailSentAt: new Date() },
    });
}

export default new NotificationRepository();
