import type { CursorPaginated, CursorQuery, PageQuery, Paginated } from '@sports-center/shared';

export const pageArgs = ({ page, limit }: PageQuery) => ({ skip: (page - 1) * limit, take: limit });

export const toPage = <T>(items: T[], total: number, { page, limit }: PageQuery): Paginated<T> => ({
  items,
  page,
  limit,
  total,
});

export type Segment<Where, OrderBy> = { where: Where; orderBy: OrderBy };

export const findSegmentedPage = async <Where, OrderBy, Row>(
  segments: Segment<Where, OrderBy>[],
  { page, limit }: PageQuery,
  count: (where: Where) => Promise<number>,
  find: (args: Segment<Where, OrderBy> & { skip: number; take: number }) => Promise<Row[]>,
): Promise<[Row[], number]> => {
  const counts = await Promise.all(segments.map(({ where }) => count(where)));
  let { skip, take } = pageArgs({ page, limit });
  const reads: Promise<Row[]>[] = [];
  segments.forEach((segment, i) => {
    const size = counts[i]!;
    if (take === 0) return;
    if (skip >= size) {
      skip -= size;
      return;
    }
    const n = Math.min(take, size - skip);
    reads.push(find({ ...segment, skip, take: n }));
    skip = 0;
    take -= n;
  });
  const total = counts.reduce((sum, n) => sum + n, 0);
  return [(await Promise.all(reads)).flat(), total];
};

type SortKey = number | string;

export const sortByKeys = <T>(rows: T[], keys: (row: T) => SortKey[]) =>
  rows
    .map((row) => ({ row, key: keys(row) }))
    .sort((a, b) => {
      for (let i = 0; i < a.key.length; i++) {
        const [x, y] = [a.key[i]!, b.key[i]!];
        if (x !== y) return x < y ? -1 : 1;
      }
      return 0;
    })
    .map(({ row }) => row);

export const cursorArgs = ({ cursor, limit }: CursorQuery) => ({
  take: limit + 1,
  ...(cursor && { cursor: { id: cursor }, skip: 1 }),
});

export const toCursorPage = <T extends { id: string }>(rows: T[], { limit }: CursorQuery): CursorPaginated<T> => {
  const items = rows.slice(0, limit);
  return { items, nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null };
};
