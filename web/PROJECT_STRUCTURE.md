# Project Structure — 360 NFC Valet (Web)

Detailed folder and file responsibilities for the web project.

## Application Layer (`src/`)

### `src/app/` — App Router (pages, layouts, API routes)

| Path | Type | Responsibility |
|---|---|---|
| `src/app/layout.tsx` | Root layout | Metadata, fonts, providers, global CSS |
| `src/app/page.tsx` | Home page | Auth check + redirect |
| `src/app/error.tsx` | Error boundary | Catches rendering errors |
| `src/app/not-found.tsx` | 404 page | Not found UI |
| `src/app/unauthorized/` | Page | 401 (unauthenticated) |
| `src/app/forbidden/` | Page | 403 (unauthorized) |
| `src/app/maintenance/` | Page | Maintenance mode screen |
| `src/app/(auth)/` | Route group | Auth flows (login, signup, MFA, forgot-password, reset-password, verify-email, invite/accept, select-plan) |
| `src/app/api/` | Route group | All API route handlers |
| `src/app/super-admin/` | Route group | Platform admin dashboard & settings |
| `src/app/tenant-admin/` | Route group | Organization admin dashboard |
| `src/app/[tenant]/` | Dynamic route | Guest-facing tenant portal |
| `src/app/globals.css` | Styles | Global styles, CSS variables |
| `src/app/favicon.ico` | Asset | Default favicon |

### `src/app/api/` — API Route Handlers

| Prefix | Purpose |
|---|---|
| `/api/auth/` | Login, logout, driver auth, driver forgot/reset password |
| `/api/driver/` | Driver dashboard, orders, history, profile, properties, queue, scan-plate, shift, push-token, notify-delay |
| `/api/platform/valet/` | Platform valet: dashboard, drivers, locations, cards, offers, orders, queue, reports, print-profiles |
| `/api/platform/backup/` | Platform backup |
| `/api/platform/pages/content/` | Platform pages content |
| `/api/v1/` | Versioned REST API: members, invites, roles, sessions, settings, audit-logs, api-keys, features, billing, organization, notifications |
| `/api/public/tap/[uid]/` | Public tap endpoint |
| `/api/public/offer/[id]/menu` | Public offer menu |
| `/api/public/offer/validate` | Public offer validation |
| `/api/webhooks/stripe` | Stripe webhook |
| `/api/webhooks/paypal` | PayPal webhook |
| `/api/cron/lifecycle-sweep` | Lifecycle sweep cron |
| `/api/mode` | Maintenance mode flag (used by proxy) |

### `src/app/(auth)/` — Authentication Routes

| Path | Files |
|---|---|
| `/login` | page.tsx, login-form.tsx, actions.ts |
| `/signup` | page.tsx, signup-form.tsx, actions.ts |
| `/signup/organization-name` | page.tsx, organization-name-form.tsx, actions.ts |
| `/forgot-password` | page.tsx, forgot-password-form.tsx, actions.ts |
| `/reset-password` | page.tsx, reset-password-form.tsx, actions.ts |
| `/verify-email` | page.tsx |
| `/invite/accept` | page.tsx, accept-invite-form.tsx, actions.ts |
| `/select-plan` | page.tsx, checkout-toast.tsx, actions.ts |
| `/login/mfa` | page.tsx, mfa-form.tsx, actions.ts, enroll/ |
| `/login/[provider]/callback` | route.ts (OAuth) |
| `/login/apple/callback` | route.ts |
| `/login/google/callback` | route.ts |

### `src/app/super-admin/` — Platform Admin

| Path | Files |
|---|---|
| `/super-admin` | page.tsx, layout.tsx |
| `/super-admin/settings` | General, security, notifications, billing |
| `/super-admin/users` | Create, edit/[id], user-detail |
| `/super-admin/organizations` | Create, edit/[id], organization-detail |
| `/super-admin/billing` | page.tsx |
| `/super-admin/audit-log` | page.tsx |

### `src/app/tenant-admin/` — Organization Admin

| Path | Files |
|---|---|
| `/tenant-admin` | page.tsx, layout.tsx |
| `/tenant-admin/valets` | CRUD pages |
| `/tenant-admin/guests` | CRUD pages |
| `/tenant-admin/orders` | CRUD pages |
| `/tenant-admin/cards` | CRUD pages |
| `/tenant-admin/wallet` | page.tsx |
| `/tenant-admin/coupons` | CRUD pages |
| `/tenant-admin/reports` | page.tsx |
| `/tenant-admin/settings` | General, security, notifications, billing, appearance, integration |
| `/tenant-admin/maintenance` | Maintenance pages |

## Components (`src/components/`)

| Folder | Content |
|---|---|
| `src/components/ui/` | shadcn/ui primitives (button, dialog, sheet, form, tooltip, sonner, etc.) |
| `src/components/forms/` | Shared form components |
| `src/components/layout/` | Header, sidebar, nav, footer |
| `src/components/auth/` | Login form, signup form, MFA, OAuth, captcha, password input |
| `src/components/dashboard/` | Stats, charts, maps |
| `src/components/orders/` | Order list, card, detail, status |
| `src/components/cards/` | NFC card components |
| `src/components/payments/` | Payment list, detail, summary |
| `src/components/guests/` | Guest list, card, detail, check-in |
| `src/components/tenant-settings/` | Settings panels (general, security, notifications, billing) |
| `src/components/super-admin/` | User/org management, system config |
| `src/components/providers/` | React providers (theme, session, query, socket) |
| `src/app/_components/error-shell.tsx` | Error shell component (app-scoped) |

## Libraries (`src/lib/`)

| File/Folder | Purpose |
|---|---|
| `src/lib/auth/` | Session, current-user, login/signup flows, OAuth, MFA, token, logout |
| `src/lib/db/` | Prisma client entry (index.ts), tenant-scoping, authorization, query helpers, encryption, rate-limit, validation |
| `src/lib/db/index.ts` | Prisma client re-export (imported by app) |
| `src/lib/db/tenant-scoping.ts` | Auto-scopes tenant models by organizationId |
| `src/lib/db/authorization.ts` | Permission/RBAC resolution |
| `src/lib/db/encryption.ts` | Encryption helpers |
| `src/lib/db/generated/` | Generated Prisma client |
| `src/lib/tenant/` | Tenant API helpers (client, pagination, types) |
| `src/lib/utils.ts` | cn() utility |
| `src/lib/valet-live.ts` | Valet real-time (server-side writer via POST /broadcast) |
| `src/lib/valet-mail.ts` | Valet email |
| `src/lib/valet-rate-limit.ts` | Rate limiting |
| `src/lib/driver-jwt.ts` | Driver JWT |
| `src/lib/driver-session.ts` | Driver session |
| `src/lib/ws.ts` | WebSocket config |
| `src/lib/public-content.ts` | Public content helpers |
| `src/lib/platform-page-identity.ts` | Platform page identity |
| `src/lib/group-permissions.ts` | Group permissions |
| `src/lib/list-query-params.ts` | Query params |
| `src/lib/format.ts` | Formatting |
| `src/lib/base-url.ts` | Base URL |
| `src/lib/brand.ts` | Brand config |
| `src/lib/countries.ts` | Country list |
| `src/lib/backup/` | Backup/restore scripts (backup-dir.js, restore.js, db.js) |

## Prisma (`prisma/`)

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Database schema (~1400 lines, 30+ models) |
| `prisma/seed.ts` | Seed script |
| `prisma/migrations/` | Migration history (39 migrations) |

## Tests

| Location | Content |
|---|---|
| `src/lib/db/__tests__/` | DB layer tests (auth, billing, RBAC, tenant scoping, etc.) |
| `src/lib/auth/__tests__/` | Auth flow tests |
| `src/lib/tenant/__tests__/` | Tenant scoping tests |
| `src/app/api/v1/__tests__/` | v1 API integration tests |
| `src/app/tenant-admin/cards/__tests__/` | Card QR/print tests |
| `src/app/tenant-admin/_lib/__tests__/` | Valet business/cross-tenant tests |
| Vitest config | `vitest.config.mts`, `vitest.setup.ts` |

## Configuration (root)

| File | Purpose |
|---|---|
| `package.json` | Dependencies and scripts |
| `next.config.ts` | Next.js config (OpenNext, authInterrupts) |
| `open-next.config.ts` | OpenNext Cloudflare config |
| `wrangler.jsonc` | Cloudflare Worker config |
| `vercel.json` | Vercel config (cron) |
| `tsconfig.json` | TypeScript config (strict, path aliases `@/`) |
| `tailwind.config.ts` | Tailwind CSS config |
| `postcss.config.mjs` | PostCSS config |
| `eslint.config.mjs` | ESLint flat config |
| `components.json` | shadcn/ui config |
| `vitest.config.mts` | Vitest config |
| `vitest.setup.ts` | Vitest setup |
| `.env` | Environment variables (gitignored, contains secrets) |
| `.gitignore` | Git ignore rules |
| `openapi.yaml` | OpenAPI spec |

## Scripts (`scripts/`)

| File | Purpose |
|---|---|
| `scripts/db/print-invoice.ts` | Print invoice script |

## Static Assets (`public/`)

| File | Purpose |
|---|---|
| `public/brand.png` | Brand image |
| `public/favicon.svg` | Favicon |
| `public/arcs-white.png` | Brand asset |
