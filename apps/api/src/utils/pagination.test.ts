import { beforeEach, describe, expect, test } from 'bun:test';

import { prisma } from '~/configs/db';
import { resetDatabase } from '~/test/db';
import { cursorArgs, pageArgs, toCursorPage, toPage } from '~/utils/pagination';

describe('pageArgs', () => {
  test('converts page and limit to skip and take', () => {
    expect(pageArgs({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
    expect(pageArgs({ page: 3, limit: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe('toPage', () => {
  test('wraps items with the page metadata', () => {
    expect(toPage(['a', 'b'], 12, { page: 2, limit: 2 })).toEqual({ items: ['a', 'b'], page: 2, limit: 2, total: 12 });
  });
});

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
    expect(first.nextCursor).toBe(first.items.at(-1)?.id ?? null);
    expect(third.items).toHaveLength(1);
    expect(third.nextCursor).toBeNull();
  });

  test('returns no next cursor when the rows fit in one page', async () => {
    await prisma.auditLog.create({ data: { action: 'TEST', entityType: 'Test', entityId: '1' } });

    const page = await listLogs({ limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });
});
