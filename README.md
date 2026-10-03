# Sports Center Management

## Tools

- [**Bun**](https://bun.sh/): Version 1.3.14 or later.
- [**PostgreSQL**](https://www.postgresql.org/download/).

## Getting Started

### Clone the repository

```bash
git clone https://github.com/HoiLauChay/sports-center-management.git
cd sports-center-management
```

### Install dependencies

```bash
bun install
```

### Setup Environment Variables

```bash
cp apps/api/.env.example apps/api/.env.development
cp apps/web/.env.example apps/web/.env.development
```

### Setup Database

```bash
bun run db:migrate
bun run db:seed
```

`db:seed` creates `system_settings` and the first manager. Run `bun run db:seed:demo` instead to also add sample sports, facilities, memberships, coaches, receptionists and members with wallet balance. Both are safe to run repeatedly.

### Run the Application

```bash
bun run dev
```

### Membership and audit pages

- Manager: `/admin/users`, `/admin/audit-logs`, `/admin/memberships`.
- Member: `/memberships`, `/memberships/mine`.
- Catalog, user management and audit log use the API. Registering a package through checkout is deferred to the checkout task.
- `/memberships/mine` uses `GET /me/memberships` and the auto-renew/cancel endpoints; it needs API task #93 for real data and actions.

### Test

Create `apps/api/.env.test` from `apps/api/.env.example`, pointing `DATABASE_URL` and `DIRECT_URL` to a database whose name ends with `_test`.

```bash
bun --filter @sports-center/api db:deploy:test
bun run test
```

### Build

```bash
bun run build
```
