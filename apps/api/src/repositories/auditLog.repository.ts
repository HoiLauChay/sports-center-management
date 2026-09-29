import type { ListAuditLogsQuery } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';
import { cursorArgs } from '~/utils/pagination';
import { toCenterDateTime } from '~/utils/time';

const auditLogSelect = {
  id: true,
  account: { select: { id: true, fullName: true } },
  action: true,
  entityType: true,
  entityId: true,
  oldValues: true,
  newValues: true,
  ipAddress: true,
  createdAt: true,
} satisfies Prisma.AuditLogSelect;

export type AuditLogRow = Prisma.AuditLogGetPayload<{ select: typeof auditLogSelect }>;

const DAY_MINUTES = 24 * 60;

class AuditLogRepository {
  create = (data: Prisma.AuditLogUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.auditLog.create({ data, select: { id: true } });

  findPage = ({ from, to, entityType, accountId, action, ...cursor }: ListAuditLogsQuery) =>
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: toCenterDateTime(from, 0), lt: toCenterDateTime(to, DAY_MINUTES) },
        entityType,
        accountId,
        action,
      },
      select: auditLogSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...cursorArgs(cursor),
    });
}

export default new AuditLogRepository();
