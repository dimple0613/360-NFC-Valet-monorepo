# 360 NFC Valet — Monorepo

One GitHub repository that manages the entire **360 NFC Valet** platform. The valet system uses NFC-tag parking cards and a ticketing queue: drivers tap their phone to activate a card, request pickup/return, and everything updates live across an Expo app, a mobile web guest page, and a full admin console — all watching the same real-time queue.

This repo consolidates four previously-separate projects into a single Turborepo + pnpm workspace so the whole product lives, is versioned, and ships in one place.

---

## What projects live here

| Folder | Project | Stack | What it does |
|--------|---------|-------|--------------|
| `web/` | **Super Admin console** | Next.js (App Router) + TypeScript + Prisma + PostgreSQL | The single admin that manages the whole app: tenant organizations, users, roles, billing, plans, and the valet business data (cards, drivers, locations, offers, queue, reports). Also the **API** the other apps call. |
| `apps/app/` | **Driver Expo app** | React Native (Expo 54) | The native mobile app drivers use to log in, tap/write NFC cards, see their parking, and request pickup or return. |
| `apps/mobile-web/` | **Mobile web guest page** | Next.js (Pages Router, plain JS) | Public, guest-facing web page (tap-to-view card status) that needs **no login**. |
| `apps/landing/` | **Landing / marketing page** | Static HTML/CSS/JS | Public marketing site for the product. |

**Shared code** lives in `packages/*` (database schema + services, shared types, config, API client) — used by `web/`.

> **Retired:** the old standalone `360-NFC-Valet/admin` console is no longer used — the `web/` super admin replaces it.

---

## Monorepo structure

```
360-NFC-Valet-monorepo/
├── web/                     # Super admin console + platform API (App Router)
│   └── src/
│       ├── app/
│       │   ├── super-admin/     # Platform operations portal (cross-org)
│       │   ├── tenant-admin/    # Single-organization portal (valet business features)
│       │   └── api/             # REST API (v1 + /api/platform/valet/* + webhooks/cron)
│       ├── components/          # Shared UI (shadcn/ui)
│       └── lib/                 # Auth, tenant resolution, ws, backup helpers
├── apps/
│   ├── app/                 # Expo driver app (React Native)
│   │   └── src/screens/         # Login, home, NFC tap, pickup, return, history, profile
│   ├── mobile-web/          # Guest mobile web (Pages Router, plain JS)
│   │   └── components/TapApp.js # All guest screens live here
│   └── landing/             # Static marketing site
├── packages/
│   ├── db/                  # Prisma schema + migrations + domain services
│   ├── api-client/          # Typed API client
│   ├── config/              # Shared TS/base configs
│   └── types/               # Shared TypeScript types
├── audit/                   # UI/audit screenshots + reports
├── CLAUDE.md / DECISIONS.md / REQUIREMENTS.md / ROADMAP.md / TASKS.md / design.md
└── pnpm-workspace.yaml, turbo.json, package.json
```

**Workspace boundaries:** the pnpm workspace covers only `web/` and `packages/*`. The `apps/*` projects are independent self-contained apps (each with its own install) — they are tracked by this single git repo but are **not** part of the super admin's pnpm/turbo toolchain, so the super admin builds stay clean.

---

## Features

**Super Admin console (`web/`)**
- **Multi-tenant platform** — many organizations (tenants), each fully isolated.
- **Two portals:** a platform **Super Admin** portal (cross-org operations) and a per-org **Tenant Admin** portal.
- **RBAC** — platform roles and tenant roles are distinct, data-driven role systems with granular permissions.
- **Auth & security** — login, signup, email verification, MFA, password reset, OAuth (Google/Apple/Microsoft), sessions.
- **Billing** — plans, add-ons, subscriptions, invoices, credit notes, usage/resource metering, Stripe + PayPal providers, tax rates, currencies.
- **Notifications framework** — in-app, email, and webhook channels (data-driven).
- **Valet business features** (tenant admin): cards, drivers, locations, offers, live queue, reports, dashboard.
- **Platform admin tools** — organizations, admins, plans, roles, invoices, currencies, tax settings, settings, backup, maintenance mode.

**Driver app (`apps/app`)**
- NFC card tap / write, car details, pickup & return requests, live status via socket.io, notifications, profile.

**Mobile web (`apps/mobile-web`)**
- Public guest page for quick card status lookups — no login required.

**Landing (`apps/landing`)**
- Static marketing site (HTML/CSS/JS).

---

## How the pieces flow

```
  [ apps/app  ] ──API + socket.io──▶    (driver + live queue events)
  [ apps/mobile-web ] ──API + socket──▶
                 │
                 ▼
        ┌───────────────────────┐
        │  web/  Super Admin    │   REST API  (P95 < 300ms)
        │  + platform API       │   WebSocket (real-time queue)
        └──────────┬────────────┘
                   │ Prisma / PostgreSQL
                   ▼
              packages/db  (multi-tenant DB)
```

- The **API** and **real-time** server live in `web/` (super admin + `/api/platform/valet/*` routes).
- `apps/app` and `apps/mobile-web` connect to that API, and use **socket.io** for live updates.
- **Multi-tenancy is automatic** — every query is scoped to the organization at the persistence layer; cross-tenant access returns 404.

---

## Getting started (new user)

Prerequisites: **Node 20+**, **pnpm 10.29.3**, and a **PostgreSQL** database. The platform also uses **Redis** (caching/queues/rate-limit) and optionally a **WebSocket** server for live updates.

```bash
# 1. Install workspace dependencies (web + packages)
pnpm install

# 2. Configure environment
#    - packages/db/.env  : DATABASE_URL (Prisma)
#    - web/.env          : VALET_DATABASE_URL, JWT_SECRET, admin creds, SMTP, WS_*, ANPR_API_KEY
#    - copy .env.example files as needed

# 3. Run database setup + seed the super admin login
pnpm --filter web run vdb:setup

# 4. Start the super admin dev server
pnpm dev                # web/ on http://localhost:3000

# 5. (Optional) Start real-time WebSocket server
pnpm --filter web run vws

# 6. Run each app independently (own install + port)
cd apps/mobile-web && npm install && npm run dev   # :3001
cd apps/landing          # static site
cd apps/app  && npm install && npx expo start     # Expo driver app
```

Default super admin login: the `ADMIN_EMAIL` / `ADMIN_PASSWORD` set in `web/.env` (default `admin@wewant360.com` / `admin123`).

Common commands (from repo root):

```bash
pnpm dev            # start web dev server
pnpm build          # prisma generate + next build
pnpm lint           # lint all workspace packages
pnpm typecheck      # typecheck all workspace packages
pnpm test           # run tests
pnpm --filter web run vdb:setup   # schema + seed (valet DB)
pnpm --filter web run vws         # websocket server (port 3002)
```

> **Note:** each of `apps/*` is a self-contained app — run `npm install` inside it before its own `npm run dev`/`build`.

---

## Git & GitHub workflow

- This is a **monorepo**: the whole product is one git repository pushed to
  **https://github.com/dimple0613/360-NFC-Valet-monorepo** (branch `master`).
- **Large binary files** (landing videos/images, app fonts) are tracked with **Git LFS** — keep big new binaries in `apps/` and they stay LFS-tracked.
- **Secrets never get committed:** `.env*` files, `google-services.json`, and local runtime dumps are git-ignored. Keep `.env.example` as the checked-in template.
- The old standalone repos (`360-NFC-Valet`, `360-NFC-Valet-mobile`) remain as historical refs; the monorepo is now the source of truth.
- **Issue/project tracking:** the GitHub **Project** and **Issues** on this repo drive which features/fixes are worked on — pick up an open issue, resolve it, and check it off.

---

## Docs

- `CLAUDE.md` — merged-app layout, build/dev commands, and working rules
- `REQUIREMENTS.md` — the full product spec (FR-100–FR-322), authoritative for *what* to build
- `DECISIONS.md` — tooling/scope decisions and rationale
- `ROADMAP.md` — phased build order, and what's deferred
- `TASKS.md` — actionable, checkbox-level task list
- Each sub-project (`web/`, `apps/app`, `apps/mobile-web`) has its own `README.md` / `AGENTS.md` with details
