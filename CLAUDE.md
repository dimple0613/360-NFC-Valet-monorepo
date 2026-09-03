# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Merged-app layout (360-NFC-Valet + saasclaude)

This repo is the saasclaude platform core with the **360-NFC-Valet admin console** merged in as the existing tenant product. Three distinct app surfaces share the `web/` Next.js project:

- **Super Admin portal** — App Router at `/super-admin/**` (saasclaude core, `src/app/super-admin/**`).
- **Tenant Admin portal** — App Router at `/tenant-admin/**` (saasclaude core).
- **360 Valet console** — legacy **Pages Router** app at `/console/**` (dashboard, queue, locations, drivers, cards, offers, reports, team, tenants, backup, profile, login). Pages live in `web/src/pages/`, non-page code in `web/valet/` (components/hooks/lib/db/scripts/docs/ws-server.js). It's a **plain-JS Pages Router app** — never introduce TypeScript or App Router conventions into it.

Ground rules that came out of the merge:

- **Two databases, always** — Prisma (platform, `@saasclaude/db`) uses `DATABASE_URL` (in `packages/db/.env`); the valet console uses `VALET_DATABASE_URL` (falling back to `DATABASE_URL` in `web/valet/lib/db.js`), set in `web/.env`. The `roles`/`role_permissions` table names collide between the two schemas, so they must never share a database.
- **Route namespacing** — App Router owns `/`, `/login`, `/signup`, `/api/v1/*`, `/super-admin/**`, `/tenant-admin/**`, `/api/cron/*`, `/api/webhooks/*`. The Pages Router owns `/console/**` and all legacy valet `/api/*` routes (`src/pages/api/**`). Next 16 requires `app` + `pages` under the same folder, so the pages app lives at `src/pages` (not a root `pages/`).
- **Aliases** — `@/*` → `./src/*` (saasclaude), `@valet/*` → `./valet/*` (legacy console). The `@valet` alias only resolves through the Next bundler — **standalone Node scripts** (`valet/db/seed.js`, `valet/ws-server.js`, `valet/scripts/*.js`) must use relative `../lib/...` imports.
- **CORS proxy** — Next 16 uses `web/proxy.ts` (middleware is deprecated here) so the legacy Pages Router API can be called cross-origin from the guest app.
- **Lint** — `eslint.config.mjs` global-ignores `src/pages/**` and `valet/**`; the legacy subtree is exempt from the core's strict TS lint.

Valet env (in `web/.env`): `VALET_DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed admin login), `ANPR_API_KEY`, SMTP_*, `WS_PORT`/`WS_ORIGIN`/`WS_BROADCAST_URL`, `NEXT_PUBLIC_WS_URL` (WebSocket for live queue), guest-URL vars. Valet commands: `pnpm --filter web run vdb:setup` (schema + seed), `vdb:reset` (drop tables), `vws` (run `valet/ws-server.js` on port 3002). Login: the `.env` admin email/password (default admin@wewant360.com / admin123).

One known inherited quirk (present in the original valet codebase, not the merge): the valet admin `session` cookie is `HttpOnly`, so the browser-side WebSocket token read (via `document.cookie`) fails and the admin queue falls back to 20s polling ("Auto-refresh"). The WS server still serves driver/guest clients. Fixing this properly is a small refactor (return a short-lived non-httpOnly WS token on login) — not yet done.

## Project status

Phase 0 (scaffold) and all of Phase 1 (1A multi-tenancy/RBAC, 1B auth/MFA/sessions, 1C billing) are done, including the post-Phase-1 gaps (MFA enrollment UI, real API-key auth + first `/api/v1` routes, Stripe checkout/webhook wiring), Phase 1 closeout (a real interactive click-through of the full Definition of Done scenario, plus wiring the two previously-unscheduled lifecycle sweeps to a real Vercel Cron endpoint), and a further post-Phase-1 round covering three brainstormed changes: **Organization membership is now flat** (Team/Workspace nesting was built in Phase 1A and later removed as unnecessary complexity — FR-106 amended; users belong directly to an org), **Tenant Admin has a two-tier nav** (a placeholder main sidebar reserved for a real deployment's own product nav + a separate `/tenant-admin/settings/**` area for Account/Security/Notifications/Sessions/API Keys/Settings/Billing/Team/Roles), and **Super Admin has a view-only cross-org Billing surface** (`/super-admin/billing` + a per-org detail section, gated on a new `core.platform.view_billing` permission). `saasclaude/` is its own git repo (see Git note below), a working Turborepo + pnpm monorepo: `web/` (Next.js App Router + TypeScript + Tailwind + shadcn/ui, Super Admin + Tenant Admin portals), `packages/config`, `packages/types`, `packages/db` (Prisma, full Phase 1 schema + services), `plugins/` and `mobile/` (placeholders only, no code). `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, and `pnpm dev` all run clean from the repo root (166 tests). Deployed to Vercel (`saasclaude-web`) against Neon Postgres + Upstash Redis.

Read these in order before writing more code:
1. `REQUIREMENTS.md` — the full spec (FR-100–FR-322), authoritative for *what* to build.
2. `DECISIONS.md` — tooling/scope decisions not covered by the spec (monorepo tool, deployment target, first auth provider, Phase 1 scope), with rationale.
3. `ROADMAP.md` — phased build order bridging the spec to an implementation sequence, plus what's explicitly deferred and why.
4. `TASKS.md` — the actionable, checkbox-level task list. Keep it current: check items off as they land, and if a task turns out unnecessary, strike it through with a one-line reason rather than deleting it.

Next up: Phase 1 is closed out — pick a Phase 2 item from `ROADMAP.md`'s "Deferred to later phases" list (module/plugin registry, additional auth/payment providers, notification framework, localization, tax engine, reporting, dynamic dashboards, full API surface, mobile app) and scope it properly before building, rather than assuming which one matters most.

Local dev note: Laragon's Postgres/Redis do not auto-start with the machine — if `pnpm dev`/tests fail with connection errors, start them manually first (`pg_ctl start -D <laragon>\data\postgresql-14`, `<laragon>\bin\redis\...\redis-server.exe redis.windows.conf`).

## Build & dev commands

Run from the repo root (Turborepo fans these out to every package):
- `pnpm install` — install all workspace deps (root, `web/`, `packages/*`)
- `pnpm dev` — start `web/`'s Next.js dev server
- `pnpm build` — `prisma generate` in `packages/db` + `next build` in `web/`
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — fan out across all packages

`packages/db` needs `DATABASE_URL` to run `prisma generate` (schema references it even without a live connection) — it reads `packages/db/.env`, copied from the root `.env.example`, not a root-level `.env`. Prisma's postinstall/build scripts are explicitly allowlisted via `pnpm.onlyBuiltDependencies` in the root `package.json` (pnpm blocks unknown packages' install scripts by default) — add any future package needing install scripts there rather than running the interactive `pnpm approve-builds`.

The `@saasclaude/db` package overrides `lint`/`typecheck`/`test` in `turbo.json` to depend on its own `build` task (`prisma generate`) — every other package's `typecheck`/`lint`/`test` only depends on `^build` (its dependencies' build), not its own, so don't copy that same-package override elsewhere unless a package similarly needs codegen before typechecking itself.

**Git root caution:** the outer `.git` at `D:\` (three levels up) still exists and is unrelated to this project — this repo's own `.git` lives at `D:\laragon\www\saasclaude`. Run git commands from inside `saasclaude/` (or with `-C`) so they hit the right repo.

## What this project is

A generic, enterprise-grade, API-first, multi-tenant SaaS boilerplate/platform core. `REQUIREMENTS.md` is the authoritative spec — read it before implementing any feature. The single most important constraint in that spec:

**The core must contain zero business-domain functionality.** No terminology or features tied to any specific industry (CRM, ERP, inventory, HRMS, POS, booking, etc.) may live in the core. All domain-specific capability is delivered exclusively through modules/plugins. When implementing anything, ask "is this a platform capability or a business feature?" — business features belong in a module, not core.

## Planned architecture (per REQUIREMENTS.md §5 Assumptions)

- **Monorepo layout:** `web/` (Next.js + React + shadcn/ui), `packages/` (shared libraries/types/utilities), `plugins/`, `mobile/`.
- **Stack:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui on the frontend; Prisma ORM against PostgreSQL.
- **Data:** local development uses local PostgreSQL + Redis (caching, queues, real-time); production uses Neon PostgreSQL with the same Prisma schema/migrations. Config is environment-variable driven so no code changes are needed between environments.
- **APIs:** web and mobile clients consume versioned REST APIs (GraphQL optional).

## Core architectural principles

These are the load-bearing rules from `REQUIREMENTS.md` that any new code must satisfy — violating them is a correctness bug, not a style preference:

- **Multi-tenancy is automatic, not opt-in.** Tenant scoping (organization) must be enforced at the persistence layer via global query scopes + tenant context — never left to individual controllers/handlers to remember. This applies to DB queries, cache keys, file storage paths, queue jobs, scheduled jobs, notifications, search indexes, webhooks, and audit logs.
- **Cross-tenant access returns 404, not 403** (avoid leaking existence of other tenants' resources), and is audit-logged.
- **Tenant context travels with async work.** Per-request resolution (session for web, header/token for API) and per-job serialization (queued payloads carry tenant context) are both required.
- **Two independent portals:** a Super Admin (platform operations) portal and a Tenant Admin (single-organization) portal, with separate RBAC systems — platform roles and tenant roles are distinct role systems, not shared.
- **Everything is configuration-driven, not hardcoded:** menus, navigation, permissions, resource limits, dashboard widgets, integrations, settings, providers, features, plans, currencies, taxes, payment gateways, auth providers, notification channels, and business rules. If a new capability requires editing core code to add an entry to a hardcoded list, that's a design smell.
- **Modules self-register.** A module ships its own migrations, models, services, policies, permissions, events, jobs, APIs, UI, tests, and localization, and registers its permissions/features/settings schemas with the platform registry at install time — the registry generates UI/config surfaces rather than the core hardcoding them.
- **Provider adapter pattern** for anything pluggable: payment providers (Stripe, Razorpay, Paddle, etc.), auth providers (OAuth2/SAML/LDAP/etc.), notification channels, storage providers — all behind standardized adapter contracts so multiple providers can be active simultaneously and new ones added without touching core.
- **RBAC is data, not code.** Roles are never hardcoded; permission checks are enforced server-side via policies, and UI visibility derives from the same permission data (never a separate, divergent UI-only check).
- **Resource quotas are registry-based**, not schema changes — new resource types (API requests, storage, seats, custom metered types) are registered, not migrated in via new columns.
- **Invoices are immutable once issued** — corrections happen via credit notes/adjustments, never in-place edits.
- **Audit records are immutable.**

## Documentation/library-lookup rule (from REQUIREMENTS.md)

The requirements doc mandates using Context7 for up-to-date library/framework documentation rather than relying on pretrained knowledge, specifically:
- Whenever generating code, configuring libraries, writing API integrations, using frameworks, or debugging library errors.
- Always before: Laravel, React, Next.js, Rust crates, PostgreSQL, Docker, Redis, GraphQL, OpenAI APIs, Anthropic APIs, MCP integration work.

Note: `REQUIREMENTS.md` §5 mentions Laravel/Rust in the Context7 rules list, but §5 Assumptions specifies a Next.js/TypeScript/Prisma stack — treat the Assumptions section as the actual target stack; the Context7 rule list is broader than what this project currently uses.

## Non-functional bar (NFR section of REQUIREMENTS.md)

Worth keeping in mind while implementing, since these shape design choices rather than being add-on polish:
- Clean Architecture / SOLID / Repository Pattern / Service Layer / DI / Event-Driven Architecture — business logic does not belong in controllers.
- API p95 < 300ms; tenant-scoped queries must always be indexed.
- GDPR-readiness (export, deletion, consent logging) and configurable data retention are first-class, not bolted on later.
- WCAG 2.1 AA accessibility applies to both portals.
