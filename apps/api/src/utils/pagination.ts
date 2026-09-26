import type { CursorPaginated, CursorQuery, PageQuery, Paginated } from '@sports-center/shared';

export const pageArgs = ({ page, limit }: PageQuery) => ({ skip: (page - 1) * limit, take: limit });

export const toPage = <T>(items: T[], total: number, { page, limit }: PageQuery): Paginated<T> => ({
  items,
  page,
  limit,
  total,
});

export const cursorArgs = ({ cursor, limit }: CursorQuery) => ({
  take: limit + 1,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
});

export const toCursorPage = <T extends { id: string }>(rows: T[], { limit }: CursorQuery): CursorPaginated<T> => {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
};
