import { prisma } from '~/configs/db';
import { CRON } from '~/constants/cron';
import notificationService from '~/services/notification.service';

export interface JobResult {
  processed: number;
  remaining: number;
}

interface BatchJob {
  findIds: (take: number) => Promise<{ id: string }[]>;
  apply: (ids: string[]) => Promise<unknown>;
  count: () => Promise<number>;
}

const runBatch = async ({ findIds, apply, count }: BatchJob): Promise<JobResult> => {
  const ids = (await findIds(CRON.BATCH_SIZE)).map(({ id }) => id);
  if (ids.length > 0) await apply(ids);
  return { processed: ids.length, remaining: await count() };
};

const sum = (results: JobResult[]) =>
  results.reduce((total, { processed, remaining }) => ({
    processed: total.processed + processed,
    remaining: total.remaining + remaining,
  }));

class CleanupService {
  run = async (now = new Date()) => {
    const before = (ms: number) => new Date(now.getTime() - ms);
    const tokenWhere = {
      OR: [
        { expiresAt: { lt: before(CRON.REFRESH_TOKEN_RETENTION) } },
        { revokedAt: { lt: before(CRON.REFRESH_TOKEN_RETENTION) } },
      ],
    };
    const otpWhere = {
      OR: [{ expiresAt: { lt: before(CRON.OTP_RETENTION) } }, { consumedAt: { lt: before(CRON.OTP_RETENTION) } }],
    };
    const notificationWhere = { createdAt: { lt: before(CRON.NOTIFICATION_RETENTION) } };
    const topUpWhere = { status: 'PENDING' as const, expiresAt: { lt: now } };

    const results = [
      await runBatch({
        findIds: (take) => prisma.walletTopUp.findMany({ where: topUpWhere, select: { id: true }, take }),
        apply: (ids) =>
          prisma.walletTopUp.updateMany({ where: { ...topUpWhere, id: { in: ids } }, data: { status: 'EXPIRED' } }),
        count: () => prisma.walletTopUp.count({ where: topUpWhere }),
      }),
      await notificationService.resendPendingEmails(),
      await runBatch({
        findIds: (take) => prisma.refreshToken.findMany({ where: tokenWhere, select: { id: true }, take }),
        apply: (ids) => prisma.refreshToken.deleteMany({ where: { id: { in: ids } } }),
        count: () => prisma.refreshToken.count({ where: tokenWhere }),
      }),
      await runBatch({
        findIds: (take) => prisma.otpCode.findMany({ where: otpWhere, select: { id: true }, take }),
        apply: (ids) => prisma.otpCode.deleteMany({ where: { id: { in: ids } } }),
        count: () => prisma.otpCode.count({ where: otpWhere }),
      }),
      await runBatch({
        findIds: (take) => prisma.notification.findMany({ where: notificationWhere, select: { id: true }, take }),
        apply: (ids) => prisma.notification.deleteMany({ where: { id: { in: ids } } }),
        count: () => prisma.notification.count({ where: notificationWhere }),
      }),
    ];

    return sum(results);
  };
}

export default new CleanupService();
