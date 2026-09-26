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

### Run the Application

```bash
bun run dev
```

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
