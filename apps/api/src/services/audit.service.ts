import type { AuditAction, AuditEntityType } from '@sports-center/shared';

import { prisma } from '~/configs/db';
import { AUDIT_FIELDS } from '~/constants/audit';
import type { Prisma } from '~/generated/prisma/client';
import auditLogRepository from '~/repositories/auditLog.repository';

type Values = Prisma.InputJsonObject;

export interface AuditEntry {
  accountId: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldValues?: object | null;
  newValues?: object | null;
  ipAddress?: string | null;
}

const serialize = (value: unknown) =>
  JSON.stringify(value, (_key, v: unknown) => (typeof v === 'bigint' ? v.toString() : v));

const only = (values: object, fields: readonly string[]): Values =>
  JSON.parse(serialize(Object.fromEntries(fields.map((field) => [field, (values as Record<string, unknown>)[field]]))));

const diff = (oldValues: object, newValues: object, fields: readonly string[]) => {
  const before = only(oldValues, fields);
  const after = only(newValues, fields);
  const changed = Object.keys(after).filter((field) => serialize(before[field]) !== serialize(after[field]));
  return { oldValues: only(before, changed), newValues: only(after, changed), changed: changed.length > 0 };
};

class AuditService {
  record = async (
    { accountId, action, entityType, entityId, oldValues, newValues, ipAddress }: AuditEntry,
    tx: Prisma.TransactionClient = prisma,
  ) => {
    const fields = AUDIT_FIELDS[entityType];
    let values: { oldValues?: Values; newValues?: Values };

    if (oldValues && newValues) {
      const result = diff(oldValues, newValues, fields);
      if (!result.changed) return null;
      values = { oldValues: result.oldValues, newValues: result.newValues };
    } else {
      values = {
        ...(oldValues && { oldValues: only(oldValues, fields) }),
        ...(newValues && { newValues: only(newValues, fields) }),
      };
    }

    return auditLogRepository.create(
      { accountId, action, entityType, entityId, ipAddress: ipAddress ?? null, ...values },
      tx,
    );
  };
}

export default new AuditService();
