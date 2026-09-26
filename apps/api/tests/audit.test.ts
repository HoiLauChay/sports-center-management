import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import auditService from '~/services/audit.service';
import { resetDatabase } from './helpers/db';

describe('auditService.record', () => {
  beforeEach(resetDatabase);

  test('stores only allowlisted fields that changed', async () => {
    await auditService.record({
      accountId: null,
      action: 'UPDATE',
      entityType: 'ACCOUNT',
      entityId: 'account-1',
      oldValues: { fullName: 'Old', status: 'ACTIVE', passwordHash: 'old-hash', dateOfBirth: new Date('2000-01-01') },
      newValues: { fullName: 'New', status: 'ACTIVE', passwordHash: 'new-hash', dateOfBirth: new Date('2000-01-02') },
      ipAddress: '127.0.0.1',
    });
    await auditService.record({
      accountId: null,
      action: 'UPDATE',
      entityType: 'MEMBER_PROFILE',
      entityId: 'account-1',
      oldValues: { healthNotes: 'old', fitnessGoals: 'lose weight' },
      newValues: { healthNotes: 'new', fitnessGoals: 'lose weight' },
    });

    const logs = await prisma.auditLog.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.oldValues).toEqual({ fullName: 'Old', dateOfBirth: '2000-01-01T00:00:00.000Z' });
    expect(logs[0]?.newValues).toEqual({ fullName: 'New', dateOfBirth: '2000-01-02T00:00:00.000Z' });
  });

  test('is rolled back with the business transaction', async () => {
    const failing = prisma.$transaction(async (tx) => {
      await auditService.record(
        { accountId: null, action: 'CREATE', entityType: 'SPORT', entityId: 'sport-1', newValues: { name: 'Tennis' } },
        tx,
      );
      throw new Error('business failure');
    });

    await expect(failing).rejects.toThrow('business failure');
    expect(await prisma.auditLog.count()).toBe(0);
  });
});
