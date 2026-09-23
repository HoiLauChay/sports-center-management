# Sports Center Management

Monorepo (Turborepo + Bun) for the Sports Center Management System.

## Structure

```
apps/
  web/                 @sports-center/web     React 19 + Vite + TanStack Router + antd (was sports-center-fe)
  api/                 @sports-center/api     Express 5 + Prisma 7 on Bun (was sports-center-be)
packages/
  shared/              @sports-center/shared  Code shared by web & api: error codes, API types, zod schemas
  typescript-config/   @sports-center/typescript-config  base / react-app / bun / library tsconfigs
  eslint-config/       @sports-center/eslint-config      base / react / node flat configs
```

## Getting started

```bash
bun install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
bun run db:migrate
bun run dev
```

## Scripts (root)

| Script              | Description                                  |
| ------------------- | -------------------------------------------- |
| `bun run dev`       | Run web + api in parallel                    |
| `bun run dev:web`   | Run only the web app                         |
| `bun run dev:api`   | Run only the api                             |
| `bun run build`     | Build every workspace                        |
| `bun run lint`      | Lint every workspace                         |
| `bun run typecheck` | Type-check every workspace                   |
| `bun run format`    | Prettier across the repo                     |
| `bun run db:*`      | Prisma commands (generate, migrate, studio…) |
