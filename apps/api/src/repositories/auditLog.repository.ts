import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

class AuditLogRepository {
  create = (data: Prisma.AuditLogUncheckedCreateInput, tx: Prisma.TransactionClient = prisma) =>
    tx.auditLog.create({ data, select: { id: true } });
}

export default new AuditLogRepository();
