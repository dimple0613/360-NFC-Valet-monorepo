# Development — 360 NFC Valet (Web)

## Local Development

```bash
cp .env.example .env   # fill required vars
npm run dev            # localhost:3000
```

## Environment Variables

Copy `.env.example` (if present) and fill required values. See README for full list of env var names. Never commit secrets.

## Database

- **Provider**: PostgreSQL (`valet_monorepo` on localhost:5432)
- **ORM**: Prisma 6 with `@prisma/adapter-pg`
- **Schema**: `prisma/schema.prisma`
- **Generated client**: `src/lib/db/generated/client/`

## Migrations

- **Dev**: `npm run prisma:migrate` (creates file in `prisma/migrations/`)
- **Prod**: `npm run prisma:deploy` (applies pending migrations)
- **Studio**: `npm run prisma:studio` (GUI)

## Seed

`npm run db:seed` — registers 28 core permissions, 14 valet permissions, 3 core resource types, 2 core notification kinds, 2 core currencies.

## Development Commands

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate && next build` |
| `npm start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |

## Testing

- **Framework**: Vitest
- **Test locations**: `src/lib/db/__tests__/`, `src/lib/auth/__tests__/`, `src/lib/tenant/__tests__/`, `src/app/api/v1/__tests__/`, `src/app/tenant-admin/cards/__tests__/`
- **Run**: `npm run test`

## Linting / Formatting

- **Lint**: `npm run lint` (ESLint flat config, Next.js + TypeScript plugins)
- **Format**: Tailwind CSS + `cn()` utility; no standalone formatter configured

## Build

- **Build**: `npm run build` (Prisma generate + Next build)
- **OpenNext build**: `npm run pages:build`
- **Preview**: `npm run pages:preview`
- **Deploy**: `npm run pages:deploy`

## Deployment / Development Workflow

- **Primary target**: Cloudflare Workers via OpenNext (`open-next.config.ts`, `wrangler.jsonc`)
- **Fallback**: Vercel (cron for lifecycle sweep via `vercel.json`)
- **Proxy**: `src/proxy.ts` — CORS + maintenance gate; `src/middleware.ts` re-exports it
- **Server external packages**: `ws`, `socket.io`, `pg`, `ioredis`, `@prisma/adapter-pg` excluded from bundle
