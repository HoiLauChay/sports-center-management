import { ERROR_CODE, type CreateMembershipBody, type UpdateMembershipBody } from '@sports-center/shared';

import { HTTP_STATUS } from '~/constants/httpStatus';
import { toMembershipResponse } from '~/mappers/membership.mapper';
import memberMembershipRepository from '~/repositories/memberMembership.repository';
import membershipRepository from '~/repositories/membership.repository';
import { ErrorWithStatus } from '~/rules/error';
import auditService from '~/services/audit.service';
import notificationService from '~/services/notification.service';
import { runTransaction } from '~/utils/transaction';

const notFound = () =>
  new ErrorWithStatus({ status: HTTP_STATUS.NOT_FOUND, code: ERROR_CODE.NOT_FOUND, message: 'Không tìm thấy gói' });

class MembershipService {
  list = async (isManager: boolean) => {
    const rows = await membershipRepository.findAll(isManager);
    return rows.map(toMembershipResponse);
  };

  create = async (managerId: string, body: CreateMembershipBody, ip?: string) => {
    const membership = await runTransaction(async (tx) => {
      const created = await membershipRepository.create(body, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'CREATE',
          entityType: 'MEMBERSHIP',
          entityId: created.id,
          newValues: created,
          ipAddress: ip,
        },
        tx,
      );
      return created;
    });
    return toMembershipResponse(membership);
  };

  update = async (managerId: string, id: string, body: UpdateMembershipBody, ip?: string) => {
    const { membership, notifications } = await runTransaction(async (tx) => {
      const current = await membershipRepository.findById(id, tx);
      if (!current) throw notFound();

      const updated = await membershipRepository.update(id, body, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'UPDATE',
          entityType: 'MEMBERSHIP',
          entityId: id,
          oldValues: current,
          newValues: updated,
          ipAddress: ip,
        },
        tx,
      );

      const deactivating = body.isActive === false && current.isActive;
      const notifications = deactivating ? await this.notifyAutoRenewMembers(id, current.name, 'ngừng bán', tx) : [];
      return { membership: updated, notifications };
    });

    notificationService.sendEmailsAfterCommit(notifications);
    return toMembershipResponse(membership);
  };

  remove = async (managerId: string, id: string, ip?: string) => {
    const notifications = await runTransaction(async (tx) => {
      const current = await membershipRepository.findById(id, tx);
      if (!current) throw notFound();

      const notifications = await this.notifyAutoRenewMembers(id, current.name, 'bị xóa', tx);

      await membershipRepository.update(id, { isActive: false, deletedAt: new Date() }, tx);
      await auditService.record(
        {
          accountId: managerId,
          action: 'DELETE',
          entityType: 'MEMBERSHIP',
          entityId: id,
          oldValues: current,
          ipAddress: ip,
        },
        tx,
      );
      return notifications;
    });

    notificationService.sendEmailsAfterCommit(notifications);
  };

  private notifyAutoRenewMembers = async (
    packageId: string,
    packageName: string,
    action: string,
    tx: Parameters<Parameters<typeof runTransaction>[0]>[0],
  ) => {
    const accountIds = await memberMembershipRepository.findAutoRenewAccountIds(packageId, tx);
    if (accountIds.length === 0) return [];
    return notificationService.create(
      accountIds.map((accountId) => ({
        accountId,
        type: 'SYSTEM' as const,
        title: `Gói thành viên đã ${action}`,
        message: `Gói "${packageName}" đã ${action}. Bạn đang bật tự động gia hạn cho gói này, vui lòng kiểm tra lại.`,
        sendEmail: true,
      })),
      tx,
    );
  };
}

export default new MembershipService();
