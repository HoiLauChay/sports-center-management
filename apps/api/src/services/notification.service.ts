import { waitUntil } from '@vercel/functions';

import { prisma } from '~/configs/db';
import { NOTIFICATION } from '~/constants/notification';
import type { Prisma } from '~/generated/prisma/client';
import notificationRepository from '~/repositories/notification.repository';
import mailService from '~/services/mail.service';
import { notificationTemplate } from '~/templates/notification.template';

export type NotificationInput = Pick<
  Prisma.NotificationCreateManyInput,
  'accountId' | 'type' | 'title' | 'message' | 'referenceType' | 'referenceId' | 'dedupKey' | 'sendEmail'
>;

export type CreatedNotification = { id: string; sendEmail: boolean };

class NotificationService {
  create = (inputs: NotificationInput[], tx: Prisma.TransactionClient = prisma) =>
    notificationRepository.createMany(inputs, tx);

  sendEmailsAfterCommit = (notifications: CreatedNotification[]) => {
    const ids = notifications.filter(({ sendEmail }) => sendEmail).map(({ id }) => id);
    if (ids.length === 0) return;
    waitUntil(
      this.sendPendingEmails({ id: { in: ids } }, ids.length).catch((err) => {
        console.error('Failed to send notification emails:', err);
      }),
    );
  };

  resendPendingEmails = async () => {
    const now = Date.now();
    const where: Prisma.NotificationWhereInput = {
      createdAt: {
        gte: new Date(now - NOTIFICATION.EMAIL_RETRY_WINDOW),
        lt: new Date(now - NOTIFICATION.EMAIL_RETRY_DELAY),
      },
    };
    const processed = await this.sendPendingEmails(where, NOTIFICATION.EMAIL_BATCH_SIZE);
    return { processed, remaining: await notificationRepository.countPendingEmails(where) };
  };

  private sendPendingEmails = async (where: Prisma.NotificationWhereInput, limit: number) => {
    const pending = await notificationRepository.findPendingEmails(where, limit);
    let sent = 0;

    for (let i = 0; i < pending.length; i += NOTIFICATION.EMAIL_BATCH_SIZE) {
      const batch = pending.slice(i, i + NOTIFICATION.EMAIL_BATCH_SIZE);
      try {
        await mailService.sendBatch(
          batch.map(({ title, message, account }) => ({
            to: account.email,
            ...notificationTemplate(account.fullName, title, message),
          })),
        );
        await notificationRepository.markEmailSent(batch.map(({ id }) => id));
        sent += batch.length;
      } catch (err) {
        console.error('Failed to send notification email batch:', err);
      }
    }

    return sent;
  };
}

export default new NotificationService();
