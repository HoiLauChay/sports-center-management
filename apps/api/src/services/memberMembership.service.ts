import { ERROR_CODE, type AutoRenewBody, type MyMemberships } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { isMembershipCurrent, toMemberMembershipResponse } from '~/mappers/memberMembership.mapper';
import accountRepository from '~/repositories/account.repository';
import bookingRepository from '~/repositories/booking.repository';
import memberMembershipRepository, { type MemberMembershipRow } from '~/repositories/memberMembership.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import { monthOf, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy gói của thành viên',
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

  setAutoRenew = async (accountId: string, id: string, body: AutoRenewBody, ip?: string) =>
    runTransaction(async (tx) => {
      await lockRows(tx, { accounts: [accountId], memberMemberships: [id] });
      const current = await memberMembershipRepository.findById(id, accountId, tx);
      if (!current) throw notFound();
      const today = todayInCenter();
      if (!isMembershipCurrent(current, today)) throw invalidState('Chỉ thay đổi tự động gia hạn cho gói còn hiệu lực');
      if (body.autoRenew && (!current.package.isActive || current.package.deletedAt)) {
        throw invalidState('Gói đã ngừng bán hoặc bị xóa, không thể bật tự động gia hạn');
      }

      const updated = await memberMembershipRepository.update(id, { autoRenew: body.autoRenew }, tx);
      await auditService.record(
        {
          accountId,
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

  cancel = async (actor: { id: string; role: Role }, accountId: string, id: string, ip?: string) =>
    runTransaction(async (tx) => {
      await lockRows(tx, { accounts: [accountId], memberMemberships: [id] });
      const current = await memberMembershipRepository.findById(id, accountId, tx);
      if (!current) throw notFound();
      const today = todayInCenter();
      if (!isMembershipCurrent(current, today)) throw invalidState('Chỉ hủy gói còn hiệu lực');

      const updated = await memberMembershipRepository.update(
        id,
        { status: 'CANCELLED', autoRenew: false, cancelledAt: new Date() },
        tx,
      );
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
}

export default new MemberMembershipService();
