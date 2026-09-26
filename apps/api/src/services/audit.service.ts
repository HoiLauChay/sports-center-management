import { prisma } from '~/configs/db';
import type { Prisma } from '~/generated/prisma/client';

export const AUDIT_ENTITY = {
  ACCOUNT: 'ACCOUNT',
} as const;

export type AuditEntity = (typeof AUDIT_ENTITY)[keyof typeof AUDIT_ENTITY];

export const AUDIT_ACTION = {
  UPDATE_PROFILE: 'UPDATE_PROFILE',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

type AuditValue = string | number | boolean | null;
export type AuditValues = Record<string, AuditValue>;

/** Fields allowed in `old_values` / `new_values` per entity; anything else is dropped. */
const AUDIT_FIELDS: Record<AuditEntity, readonly string[]> = {
  ACCOUNT: [
    'fullName',
    'phone',
    'dateOfBirth',
    'gender',
    'address',
    'avatarUrl',
    'role',
    'status',
    'emergencyContact',
    'fitnessGoals',
    'bio',
    'experience',
    'certifications',
    'coverImageUrl',
    'staffNotes',
  ],
};

// Never audited, even if someone adds them to an allowlist by mistake.
const NEVER_AUDITED = new Set(['password', 'passwordHash', 'otp', 'codeHash', 'token', 'tokenHash', 'healthNotes']);

export const pickAuditFields = (entityType: AuditEntity, values: AuditValues | null | undefined) => {
  if (!values) return null;
  const allowed = AUDIT_FIELDS[entityType];
  const picked: AuditValues = {};
  for (const key of allowed) {
    if (!NEVER_AUDITED.has(key) && key in values) picked[key] = values[key]!;
  }
  return Object.keys(picked).length > 0 ? picked : null;
};

/** Keeps only the allowed fields whose value changed between `before` and `after`. */
export const diffAuditFields = (entityType: AuditEntity, before: AuditValues, after: AuditValues) => {
  const changedBefore: AuditValues = {};
  const changedAfter: AuditValues = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changedBefore[key] = before[key] ?? null;
      changedAfter[key] = after[key]!;
    }
  }
  return {
    oldValues: pickAuditFields(entityType, changedBefore),
    newValues: pickAuditFields(entityType, changedAfter),
  };
};

interface AuditEntry {
  accountId: string | null;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  oldValues?: AuditValues | null;
  newValues?: AuditValues | null;
  ipAddress?: string | null;
}

class AuditService {
  /** Pass the business transaction client so the audit row rolls back together with the change. */
  record = (entry: AuditEntry, tx: Prisma.TransactionClient = prisma) => {
    const oldValues = pickAuditFields(entry.entityType, entry.oldValues);
    const newValues = pickAuditFields(entry.entityType, entry.newValues);
    return tx.auditLog.create({
      data: {
        accountId: entry.accountId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        ...(oldValues && { oldValues }),
        ...(newValues && { newValues }),
        ipAddress: entry.ipAddress?.slice(0, 45) ?? null,
      },
      select: { id: true },
    });
  };
}

export default new AuditService();
