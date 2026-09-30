import type { CreateMembershipBody } from '@sports-center/shared';

import { toMembershipResponse } from '~/mappers/membership.mapper';
import membershipRepository from '~/repositories/membership.repository';
import auditService from '~/services/audit.service';
import { runTransaction } from '~/utils/transaction';

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
}

export default new MembershipService();
