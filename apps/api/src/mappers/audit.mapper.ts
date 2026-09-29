import type { AuditAction, AuditEntityType, AuditLog } from '@sports-center/shared';

import type { AuditLogRow } from '~/repositories/auditLog.repository';

type Values = AuditLog['oldValues'];

export const toAuditLogResponse = (log: AuditLogRow): AuditLog => ({
  id: log.id,
  account: log.account,
  action: log.action as AuditAction,
  entityType: log.entityType as AuditEntityType,
  entityId: log.entityId,
  oldValues: log.oldValues as Values,
  newValues: log.newValues as Values,
  ipAddress: log.ipAddress,
  createdAt: log.createdAt.toISOString(),
});
