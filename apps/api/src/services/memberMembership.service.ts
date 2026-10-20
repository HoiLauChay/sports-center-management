import {
  ERROR_CODE,
  type MyMemberships,
  type StaffMembershipResult,
  type SubscribeMemberBody,
} from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { isMembershipCurrent, toMemberMembershipResponse } from '~/mappers/memberMembership.mapper';
import accountRepository from '~/repositories/account.repository';
import bookingRepository from '~/repositories/booking.repository';
import memberMembershipRepository, { type MemberMembershipRow } from '~/repositories/memberMembership.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import checkoutService from '~/services/checkout/checkout.service';
import notificationService, { type CreatedNotification } from '~/services/notification.service';
import { formatCenterDate, monthOf, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy gói của thành viên',
  });

const memberNotFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy thành viên',
  });

const invalidState = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });

const toResponse = async (row: MemberMembershipRow, today: string, tx?: Prisma.TransactionClient) => {
  if (!isMembershipCurrent(row, today)) return toMemberMembershipResponse(row, today, 0);
  const { slotDurationMinutes } = await settingRepository.get(tx);
  const used = await bookingRepository.countFreeSlots(row.accountId, monthOf(today), slotDurationMinutes, tx);
  return toMemberMembershipResponse(row, today, used);
};

class MemberMembershipService {
  list = async (accountId: string): Promise<MyMemberships> => {
    if (!(await accountRepository.findById(accountId, 'MEMBER'))) throw notFound();
    const today = todayInCenter();
    const rows = await memberMembershipRepository.findByAccount(accountId);
    const current = rows.find((row) => isMembershipCurrent(row, today));
    return {
      current: current ? await toResponse(current, today) : null,
      history: rows.filter((row) => row !== current).map((row) => toMemberMembershipResponse(row, today, 0)),
    };
  };

  cancel = async (actor: { id: string; role: Role }, accountId: string, id: string, ip?: string) =>
    runTransaction(async (tx) => {
      await lockRows(tx, { accounts: [accountId], memberMemberships: [id] });
      const current = await memberMembershipRepository.findById(id, accountId, tx);
      if (!current) throw notFound();
      const today = todayInCenter();
      if (!isMembershipCurrent(current, today)) throw invalidState('Chỉ hủy gói còn hiệu lực');
      if (current.cancelledAt) throw invalidState('Gói đã được hủy trước đó');

      const updated = await memberMembershipRepository.update(id, { autoRenew: false, cancelledAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: actor.id,
          action: 'UPDATE',
          entityType: 'MEMBER_MEMBERSHIP',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );
      return toResponse(updated, today, tx);
    });

  subscribe = async (
    actor: { id: string; role: Role },
    accountId: string,
    body: SubscribeMemberBody,
    ip?: string,
  ): Promise<StaffMembershipResult> => {
    const account = await accountRepository.findById(accountId, 'MEMBER');
    if (account?.status !== 'ACTIVE') throw memberNotFound();

    const order = await checkoutService.chargeMembership(actor, accountId, body);
    const membershipId = order.items[0]!.refId!;
    const row = (await memberMembershipRepository.findById(membershipId, accountId))!;
    await auditService.record({
      accountId: actor.id,
      action: 'CREATE',
      entityType: 'MEMBER_MEMBERSHIP',
      entityId: membershipId,
      newValues: row,
      ipAddress: ip,
    });
    return { order, membership: await toResponse(row, todayInCenter()) };
  };

  terminate = async (actor: { id: string; role: Role }, accountId: string, id: string, reason: string, ip?: string) => {
    let notifications: CreatedNotification[] = [];
    const result = await runTransaction(async (tx) => {
      await lockRows(tx, { accounts: [accountId], memberMemberships: [id] });
      const current = await memberMembershipRepository.findById(id, accountId, tx);
      if (!current) throw notFound();
      const today = todayInCenter();
      if (!isMembershipCurrent(current, today)) throw invalidState('Chỉ chấm dứt gói còn hiệu lực');

      const updated = await memberMembershipRepository.update(
        id,
        { status: 'CANCELLED', endDate: new Date(today), autoRenew: false, cancelledAt: new Date() },
        tx,
      );
      await auditService.record(
        {
          accountId: actor.id,
          action: 'UPDATE',
          entityType: 'MEMBER_MEMBERSHIP',
          entityId: id,
          oldValues: current,
          newValues: { ...updated, reason },
          ipAddress: ip,
        },
        tx,
      );
      notifications = await notificationService.create(
        [
          {
            accountId,
            type: 'MEMBERSHIP',
            title: 'Gói thành viên đã chấm dứt',
            message: `Gói ${current.package.name} đã chấm dứt từ ngày ${formatCenterDate(today)}, không hoàn tiền. Lý do: ${reason}`,
            referenceType: 'MEMBERSHIP',
            referenceId: id,
            dedupKey: `membership-terminated:${id}`,
            sendEmail: true,
          },
        ],
        tx,
      );
      return toResponse(updated, today, tx);
    });
    notificationService.sendEmailsAfterCommit(notifications);
    return result;
  };
}

export default new MemberMembershipService();
