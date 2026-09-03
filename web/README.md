This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Local development services (Postgres + Redis)

Local dev uses Laragon's bundled PostgreSQL and Redis rather than Docker Compose — both already run as part of the Laragon stack, so there's no extra service to manage.

- PostgreSQL 14.5, listening on `127.0.0.1:5432`. A dedicated `saasclaude` database and a scoped `saasclaude` login role (non-superuser, `NOCREATEDB`/`NOCREATEROLE`) were created — the app connects as that role rather than the `postgres` superuser, mirroring the least-privilege connection a Neon project would give in production. Credentials live in `packages/db/.env` (`DATABASE_URL`), gitignored.
- Redis 5.0.14, listening on `127.0.0.1:6379`, no auth (dev only).

To recreate the database/role after a fresh Postgres install:

```sql
CREATE DATABASE saasclaude;
CREATE ROLE saasclaude WITH LOGIN PASSWORD 'saasclaude_dev' NOSUPERUSER NOCREATEROLE;
GRANT ALL PRIVILEGES ON DATABASE saasclaude TO saasclaude;
GRANT ALL ON SCHEMA public TO saasclaude;
ALTER ROLE saasclaude CREATEDB;
```

The role needs `CREATEDB` because `prisma migrate dev` provisions a throwaway shadow database on each run to detect drift — it's not a schema privilege, just permission to spin up/tear down that scratch DB locally. Production migrations against Neon use a different flow and don't need this.

After pulling schema changes, run `pnpm --filter @saasclaude/db exec prisma migrate dev` to apply them locally. The tenant-scoping regression tests (`packages/db/src/__tests__/tenant-scoping.test.ts`) are integration tests that hit this local database directly — they create and clean up their own fixture rows, but they do need the schema migrated first.

Then copy `.env.example` (repo root) to `packages/db/.env` and set `DATABASE_URL="postgresql://saasclaude:saasclaude_dev@localhost:5432/saasclaude?schema=public"`.

After migrating, run `pnpm --filter @saasclaude/db run seed` to register core's permission catalog (idempotent — safe to re-run anytime).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
