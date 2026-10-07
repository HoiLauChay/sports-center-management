import { ERROR_CODE, type AutoRenewBody, type MyMemberships } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import type { Prisma, Role } from '~/generated/prisma/client';
import { isMembershipCurrent, toMemberMembershipResponse } from '~/mappers/memberMembership.mapper';
import accountRepository from '~/repositories/account.repository';
import bookingRepository from '~/repositories/booking.repository';
import memberMembershipRepository from '~/repositories/memberMembership.repository';
import settingRepository from '~/repositories/setting.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import { formatDate, fromDbTime, todayInCenter } from '~/utils/time';
import { lockRows, runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODE.NOT_FOUND,
    message: 'Không tìm thấy gói của thành viên',
  });

const invalidState = (message: string) =>
  new ErrorWithStatus({ status: HTTP_STATUS.CONFLICT, code: ERROR_CODE.INVALID_STATE, message });

class MemberMembershipService {
  private freeSlotsUsed = async (accountId: string, today: string, tx: Prisma.TransactionClient) => {
    const [year, month] = today.split('-').map(Number);
    const from = `${today.slice(0, 7)}-01`;
    const to = formatDate(new Date(Date.UTC(year!, month!, 1)));
    const [bookings, settings] = await Promise.all([
      bookingRepository.findFreeSlotTimes(accountId, from, to, tx),
      settingRepository.get(tx),
    ]);
    return bookings.reduce(
      (sum, { startTime, endTime }) =>
        sum + (fromDbTime(endTime) - fromDbTime(startTime)) / settings.slotDurationMinutes,
      0,
    );
  };

  list = async (accountId: string): Promise<MyMemberships> =>
    runTransaction(async (tx) => {
      if (!(await accountRepository.findById(accountId, 'MEMBER', tx))) throw notFound();
      const today = todayInCenter();
      const [rows, used] = await Promise.all([
        memberMembershipRepository.findMine(accountId, tx),
        this.freeSlotsUsed(accountId, today, tx),
      ]);
      const mapped = rows.map((row) => toMemberMembershipResponse(row, today, used));
      const currentId = rows.find((row) => isMembershipCurrent(row, today))?.id;
      return {
        current: mapped.find(({ id }) => id === currentId) ?? null,
        history: mapped.filter(({ id }) => id !== currentId),
      };
    });

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
      return toMemberMembershipResponse(updated, today, await this.freeSlotsUsed(accountId, today, tx));
    });

  cancel = async (actor: { id: string; role: Role }, accountId: string, id: string, ip?: string) =>
    runTransaction(async (tx) => {
      if (actor.role === 'MEMBER' && actor.id !== accountId) throw notFound();
      await lockRows(tx, { accounts: [accountId], memberMemberships: [id] });
      const current = await memberMembershipRepository.findById(id, accountId, tx);
      if (!current) throw notFound();
      const today = todayInCenter();
      if (!isMembershipCurrent(current, today)) throw invalidState('Chỉ hủy gói còn hiệu lực');
      const updated = await memberMembershipRepository.update(
        id,
        {
          status: 'CANCELLED',
          autoRenew: false,
          cancelledAt: new Date(),
        },
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
      return toMemberMembershipResponse(updated, today, await this.freeSlotsUsed(accountId, today, tx));
    });
}

export default new MemberMembershipService();
