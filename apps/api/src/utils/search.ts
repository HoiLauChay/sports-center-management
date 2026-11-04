import { Prisma } from '~/generated/prisma/client';

const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

export const unaccentContains = (column: Prisma.Sql, q: string) =>
  Prisma.sql`unaccent(${column}) ILIKE unaccent(${`%${escapeLike(q)}%`})`;
