import { Prisma } from '~/generated/prisma/client';

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

/**
 * `column` contains `q`, ignoring case and Vietnamese marks: "nguyen van" finds "Nguyễn Văn", "dung" finds "Dũng".
 * Prisma's `contains` only ignores case, so name searches use this in a raw query for the matching ids.
 */
export const unaccentContains = (column: Prisma.Sql, q: string) =>
  Prisma.sql`unaccent(${column}) ILIKE unaccent(${`%${escapeLike(q)}%`})`;
