# Sports Center Management

## Tools

- [**Bun**](https://bun.sh/): Version 1.3.14 or later.
- [**PostgreSQL**](https://www.postgresql.org/download/).

## Getting Started

### Clone the repository

```bash
git clone https://github.com/sports-center-management/sports-center-management.git
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

### Build

```bash
bun run build
```
