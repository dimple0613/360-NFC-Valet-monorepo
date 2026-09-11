# Agents — 360 NFC Valet (Web)

Practical rules for AI/coding agents working on this platform.

## Project Architecture Overview

Multi-tenant SaaS platform (Super Admin + Tenant Admin). Main code is under `src/`:
- `src/app/` — App Router routes, layouts, pages
- `src/components/` — UI + forms + layout
- `src/lib/` — Auth, DB, utils, services, tenant helpers
- `src/proxy.ts` — single Next 16 proxy (CORS + maintenance gate)

## Important Folders

| Folder | Never modify manually? | Why |
|---|---|---|
| `src/app/(auth)/` | Yes | Auth flow critical; uses server actions + redirect pattern |
| `src/lib/auth/` | Yes | Session/cookie, MFA, OAuth, password reset (token based) |
| `src/lib/db/tenant-scoping.ts` | Yes | Tenant scoping enforcement; touching it breaks isolation |
| `prisma/` | Yes (except seed/migrations) | Schema + history — test changes in local dev only |
| `src/proxy.ts` | Yes | Single proxy (CORS + maintenance), rules in code |
| `src/app/api/` | Yes | Route handlers; calls are trusted at server boundary |

## Files That Should Not Be Modified

- `src/middleware.ts` (only re-exports `src/proxy.ts`)
- `src/app/layout.tsx` (metadata, font vars, providers)
- Generated client (`src/lib/db/generated/client/`)

## Generated Files

- `src/lib/db/generated/client/` (Prisma client, delete if manually editing)

## Database Rules

- Use Prisma client (`db()` helper) for tenant-scoped queries
- Use `raw()` PG client (`src/app/tenant-admin/_lib/db.ts`) only for legacy queries
- Never write raw SQL for new queries
- Migrations: `prisma:migrate` (dev), `prisma:deploy` (prod)
- Seed: `db:seed` populates permissions + sample data

## Authentication Rules

- Auth flows via Server Actions + `redirect()`; catch `NEXT_REDIRECT` in client
- CAPTCHA: server-side in every mutation action
- MFA: TOTP via `mfaEnabled`/`mfaSecretEncrypted`, recovery codes hashed
- Session token: `session_token`, HttpOnly, `managedByClient` refreshed automatically
- OAuth: `state` param, PKCE, `redirectUri`

## Coding Conventions

- Server Actions first ("use server") with Formik + Yup validation
- Client components for forms, dashboards, maps, tables, auth UI
- Error handling: try/catch → state object with `errorMessage`; toast on client
- Redirect on success; catch `NEXT_REDIRECT` to update client state
- Import order: Node built-ins → third-party → local
- `cn()` utility for class merging
- Types: always define shapes (`SignupFormState`, etc.)

## Testing Requirements

- Write or maintain existing Vitest tests
- Focus on Server Actions, auth flows, tenant scoping
- Test routes: PUT/POST/DELETE via API tests
- Coverage: lib/auth, lib/tenant, tenant-admin, api
- Run tests: `npm run test`

## Important Commands

| Command | Use |
|---|---|
| `npm run dev` | Dev server (localhost:3000) |
| `npm run build` | Prisma generate + Next build |
| `npm start` | Production server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run prisma:migrate` | Dev migration (creates file in prisma/migrations) |
| `npm run prisma:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed permissions + data |

## Common Pitfalls

- `src/lib/db/` has `db()` helper with tenant scoping — use that (don’t query models directly)
- Server Actions auto-throw `NEXT_REDIRECT` on success — catch in client to update UI
- Server Actions validate CAPTCHA, rate limiting, MFA in action itself
- Routes under `src/app/api/` are trusted endpoints — never call them directly from client UI
- Use `current-user.ts` for session resolution; never reimplement auth logic
- `src/proxy.ts` includes maintenance mode (configured via platform setting)
- Place new tenant-scoped models in `src/lib/db/tenant-scoping.ts`'s list
- `src/app/api/mode` flag drives maintenance mode (via proxy)

## Where to Investigate

**Feature implementations**: Search `src/components/*.tsx` for UI, `src/lib/auth/` for auth, `src/lib/db/` for queries.

**Forms**: `src/components/` (action-form.tsx, action-button.tsx) and actions in parent directory.

**Auth flows**: `src/lib/auth/` and `src/app/(auth)/` actions pages.

**API endpoint**: Look for `src/app/api/<feature>/route.ts`.

**RBAC**: `src/lib/db/tenant-scoping.ts` (Role/Permission), `src/lib/db/authorization.ts`, `src/components/permission-picker.tsx`.

**Database**: `prisma/` (schema), `src/lib/db/` (query helpers), use Prisma client (`db()` from `src/lib/db/index.ts`).

**Shared components**: `src/components/ui/` (shadcn), `src/components/` root.

**Services/adapters**: `src/lib/` (auth, billing, webhook via lib/db/*).

**State management**: Server Actions + React Server Components; React Query (`@/lib/query`) (if exists).

**WebSocket**: `ws-server.ts` (standalone server), `src/lib/valet-live.ts` (server-side writer), `src/lib/ws.ts` (client config).

**Configuration**: `next.config.ts`, `open-next.config.ts`, `wrangler.jsonc`, `prisma/schema.prisma`.

**Testing**: Vitest config at root; tests under `src/lib/db/__tests__/`.
