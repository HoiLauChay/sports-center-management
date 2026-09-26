import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import { assertTestDatabase, resetDatabase } from '~/test/db';

describe('assertTestDatabase', () => {
  test('rejects a database whose name does not end with _test', () => {
    expect(() => assertTestDatabase('postgresql://user:pass@localhost:5432/sports_center')).toThrow();
  });

  test('accepts a database whose name ends with _test', () => {
    expect(() => assertTestDatabase('postgresql://user:pass@localhost:5432/sports_center_test')).not.toThrow();
  });
});

describe('resetDatabase', () => {
  beforeEach(resetDatabase);

  test('removes rows from every table', async () => {
    await prisma.account.create({
      data: { email: 'member@example.com', passwordHash: 'hash', fullName: 'Member', memberProfile: { create: {} } },
    });
    expect(await prisma.account.count()).toBe(1);
    expect(await prisma.memberProfile.count()).toBe(1);

    await resetDatabase();

    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.memberProfile.count()).toBe(0);
  });
});
