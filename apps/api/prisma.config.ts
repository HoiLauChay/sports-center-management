import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: `.env.${process.env.NODE_ENV ?? 'development'}`, quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun src/seeds/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
