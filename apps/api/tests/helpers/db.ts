import { prisma } from '~/configs/db';
import { env } from '~/configs/env';
import { Prisma } from '~/generated/prisma/client';

export const assertTestDatabase = (url: string) => {
  const name = new URL(url).pathname.slice(1);
  if (process.env.NODE_ENV !== 'test' || !name.endsWith('_test')) {
    throw new Error(
      `Refusing to reset database "${name}": tests must run with NODE_ENV=test against a database whose name ends with "_test"`,
    );
  }
};

export const resetDatabase = async () => {
  assertTestDatabase(env.DATABASE_URL);
  const [row] = await prisma.$queryRaw<{ tables: string | null }[]>`
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') AS tables
    FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const tables = row?.tables;
  if (!tables) return;
  await prisma.$executeRaw`TRUNCATE TABLE ${Prisma.raw(tables)} RESTART IDENTITY CASCADE`;
};
