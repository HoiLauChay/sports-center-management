import { PrismaPg } from '@prisma/adapter-pg';
import { attachDatabasePool } from '@vercel/functions';
import { Pool } from 'pg';

import { env } from '~/configs/env';
import { PrismaClient } from '~/generated/prisma/client';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 5,
  // Prisma's pg adapter expects UTC for both scalar and nested timestamptz values.
  onConnect: async (client) => {
    await client.query("SET TIME ZONE 'UTC'");
  },
});

attachDatabasePool(pool);

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
