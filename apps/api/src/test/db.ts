import { prisma } from '~/configs/db';
import { env } from '~/configs/env';

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
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
};
