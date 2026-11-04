import type { CursorPaginated, CursorQuery, PageQuery, Paginated } from '@sports-center/shared';

export const pageArgs = ({ page, limit }: PageQuery) => ({ skip: (page - 1) * limit, take: limit });

export const toPage = <T>(items: T[], total: number, { page, limit }: PageQuery): Paginated<T> => ({
  items,
  page,
  limit,
  total,
});

/** The `findMany` args of one page when rows are listed group after group; `sizes` holds each group's row count. */
export const pageOfGroups = <Group>(groups: Group[], sizes: number[], { page, limit }: PageQuery) => {
  let { skip, take } = pageArgs({ page, limit });
  return groups.flatMap((group, index) => {
    const size = sizes[index]!;
    const rows = Math.min(take, Math.max(size - skip, 0));
    const args = rows > 0 ? [{ ...group, skip, take: rows }] : [];
    skip = Math.max(skip - size, 0);
    take -= rows;
    return args;
  });
};

export const cursorArgs = ({ cursor, limit }: CursorQuery) => ({
  take: limit + 1,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
});

export const toCursorPage = <T extends { id: string }>(rows: T[], { limit }: CursorQuery): CursorPaginated<T> => {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
};
