import type { AuditAction, AuditEntityType } from '../constants/enums';

export interface Person {
  id: string;
  fullName: string;
}

export interface AuditLog {
  id: string;
  account: Person | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}
