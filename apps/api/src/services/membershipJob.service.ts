import { CRON } from '~/constants/cron';
import type { Prisma } from '~/generated/prisma/client';
import memberMembershipRepository from '~/repositories/memberMembership.repository';
import membershipRepository from '~/repositories/membership.repository';
import settingRepository from '~/repositories/setting.repository';
import walletRepository from '~/repositories/wallet.repository';
import { commitOrder } from '~/services/checkout/commitOrder';
import { renewalOrder } from '~/services/checkout/lines/membership';
import type { CheckoutContext } from '~/services/checkout/types';
import notificationService, { type CreatedNotification, type NotificationInput } from '~/services/notification.service';
import { idempotencyKey } from '~/utils/idempotency';
import { retryOnDuplicateCode } from '~/utils/paymentCode';
import { addDays, formatCenterDate, formatDate, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

type Outcome = 'renewed' | 'expired' | 'cancelled' | 'skipped';

const ended = (
  membership: { id: string; accountId: string; endDate: Date; package: { name: string } },
  title: string,
  message: string,
): NotificationInput => ({
  accountId: membership.accountId,
  type: 'MEMBERSHIP',
  title,
  message,
  referenceType: 'MEMBERSHIP',
  referenceId: membership.id,
  dedupKey: `membership-ended:${membership.id}:${formatDate(membership.endDate)}`,
  sendEmail: true,
});

const settle = async (tx: Prisma.TransactionClient, id: string, accountId: string, now: Date) => {
  await lockRows(tx, { accounts: [accountId], memberProfiles: [accountId], memberMemberships: [id] });
  const current = await memberMembershipRepository.findForJob(id, tx);
  const today = todayInCenter(now);
  if (!current || current.status !== 'ACTIVE' || formatDate(current.endDate) > today) {
    return { outcome: 'skipped' as Outcome, notifications: [] };
  }

  const name = current.package.name;
  const endDay = formatCenterDate(formatDate(current.endDate));
  if (current.cancelledAt) {
    await memberMembershipRepository.update(id, { status: 'CANCELLED' }, tx);
    const notice = ended(
      current,
      'Gói thành viên đã kết thúc',
      `Gói ${name} đã kết thúc ngày ${endDay} theo yêu cầu hủy.`,
    );
    return { outcome: 'cancelled' as Outcome, notifications: await notificationService.create([notice], tx) };
  }

  const membership = await membershipRepository.findById(current.packageId, tx);
  const start = formatDate(current.endDate);
  const reason = !current.autoRenew
    ? null
    : !membership?.isActive
      ? 'gói đã ngừng bán'
      : addDays(start, membership.durationDays) <= today
        ? 'đã quá hạn gia hạn'
        : (await walletRepository.readBalance(accountId, tx)) < Number(membership.price)
          ? 'số dư ví không đủ'
          : undefined;

  if (reason === undefined && membership) {
    const ctx: CheckoutContext = {
      buyer: { kind: 'MEMBER', accountId },
      actor: { id: accountId, role: 'MEMBER' },
      now,
      settings: await settingRepository.get(tx),
      benefits: null,
      planned: [],
    };
    const committed = await commitOrder(tx, ctx, renewalOrder(membership, id, start), {
      method: 'WALLET',
      idempotencyKey: idempotencyKey.renew(id, current.endDate),
      requestHash: null,
    });
    const renewed = await notificationService.create(
      [
        {
          accountId,
          type: 'MEMBERSHIP',
          title: 'Đã tự động gia hạn gói',
          message: `Gói ${name} đã được gia hạn đến ${formatCenterDate(addDays(start, membership.durationDays))}.`,
          referenceType: 'MEMBERSHIP',
          referenceId: id,
          dedupKey: `membership-renewed:${id}:${start}`,
          sendEmail: true,
        },
      ],
      tx,
    );
    return { outcome: 'renewed' as Outcome, notifications: [...committed.notifications, ...renewed] };
  }

  await memberMembershipRepository.update(id, { status: 'EXPIRED' }, tx);
  const message = reason
    ? `Gói ${name} đã hết hạn ngày ${endDay} và không tự gia hạn được vì ${reason}.`
    : `Gói ${name} đã hết hạn ngày ${endDay}.`;
  const notice = ended(current, 'Gói thành viên đã hết hạn', message);
  return { outcome: 'expired' as Outcome, notifications: await notificationService.create([notice], tx) };
};

class MembershipJobService {
  run = async (now = new Date()) => {
    const today = todayInCenter(now);
    const counts = { renewed: 0, expired: 0, cancelled: 0, failed: 0 };
    let notifications: CreatedNotification[] = [];

    for (const { id, accountId } of await memberMembershipRepository.findDueIds(today, CRON.BATCH_SIZE)) {
      try {
        const result = await retryOnDuplicateCode('order_number_key', () =>
          retryOnDuplicateCode('transaction_code_key', () => runTransaction((tx) => settle(tx, id, accountId, now))),
        );
        if (result.outcome !== 'skipped') counts[result.outcome] += 1;
        notifications = [...notifications, ...result.notifications];
      } catch (err) {
        counts.failed += 1;
        console.error(`Membership job failed for ${id}:`, err);
      }
    }

    notificationService.sendEmailsAfterCommit(notifications);
    return { ...counts, remaining: await memberMembershipRepository.countDue(today) };
  };
}

export default new MembershipJobService();
