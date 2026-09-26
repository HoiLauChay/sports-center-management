import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import { cursorArgs, toCursorPage } from '~/utils/pagination';
import { resetDatabase } from './helpers/db';

describe('cursor pagination', () => {
  beforeEach(resetDatabase);

  const listLogs = async (query: { cursor?: string; limit: number }) =>
    toCursorPage(
      await prisma.auditLog.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...cursorArgs(query),
      }),
      query,
    );

  test('walks every row exactly once in order', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    await prisma.auditLog.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        action: 'TEST',
        entityType: 'Test',
        entityId: String(i),
        createdAt: i < 3 ? createdAt : new Date(createdAt.getTime() + i * 1000),
      })),
    });
    const expected = await prisma.auditLog.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });

    const first = await listLogs({ limit: 2 });
    const second = await listLogs({ cursor: first.nextCursor ?? undefined, limit: 2 });
    const third = await listLogs({ cursor: second.nextCursor ?? undefined, limit: 2 });

    expect([...first.items, ...second.items, ...third.items].map(({ id }) => id)).toEqual(expected.map(({ id }) => id));
    expect(third.items).toHaveLength(1);
    expect(third.nextCursor).toBeNull();
  });
});
