# Architecture — 360 NFC Valet (Web)

## Application Architecture

Next.js 16 App Router, React 19, TypeScript strict. Primary deployment target: Cloudflare Workers via OpenNext; Vercel fallback for cron. Server-rendered by default; client components only where interactivity demands (forms, dashboards, maps).

## Request / Data Flow

```
Browser
  ↓
Next.js Proxy (src/proxy.ts — CORS + maintenance gate; middleware.ts re-exports it)
  ↓
Root Layout (src/app/layout.tsx) — providers, theme, font, favicon
  ↓
Server Component (page/layout)
  ↓   Server Action (mutation)  OR  API Route (REST/webhook)
  ↓
Service (src/lib/services/ or lib/db/*)
  ↓
Prisma Client (src/lib/db/generated/client) via driverAdapters → PostgreSQL (localhost:5432, valet_monorepo)
  ↓
Response → UI (sonner toasts, redirect())
```

## Folder Responsibilities

| Folder | Role |
|---|---|
| `src/app/(auth)/` | Auth group: login, signup, MFA, forgot/reset password, verify-email, invite-accept, select-plan |
| `src/app/api/` | Route handlers — auth, driver-auth, platform valet APIs, v1 REST, webhooks (Stripe/PayPal), public tap/offer, mode, cron |
| `src/app/super-admin/` | Platform dashboard, settings (general/security/notifications/billing), user/org mgmt, audit log |
| `src/app/tenant-admin/` | Org admin dashboard — valets, guests, orders, cards, coupons, wallet, reports, settings |
| `src/app/[tenant]/` | Guest-facing portal — check-in/out, reservations, profile, payment-success |
| `src/components/` | UI (shadcn), forms, layout, auth, dashboard, orders, cards, payments, coupon, tenant-settings, super-admin, providers |
| `src/lib/auth/` | Session, current-user, login/signup flows, OAuth, MFA, token, logout |
| `src/lib/db/` | Prisma client, tenant-scoping, per-model query helpers, validation, constants |
| `src/lib/services/` | Auth, billing, cache, socket, analytics, webhook adapters |
| `src/lib/tenant/` | Tenant API helpers (client, pagination, types) |
| `src/lib/utils/` | cn, format-date/currency/time |
| `prisma/` | Schema (~1400 lines, 30+ models), 39 migrations, seed |
| `tests/` | Vitest — lib/auth, tenant, tenant-admin, api |

## Component Architecture

- **shadcn/ui** (`src/components/ui/`) — base primitives (button, dialog, sheet, form, tooltip, sonner)
- **Feature components** (`src/components/dashboard/`, `orders/`, `cards/`, `payments/`, `guests/`, `super-admin/`, `tenant-settings/`) — feature-specific, colocated with pages
- **Form components** (`src/components/forms/`) — shared form wrappers
- **Providers** (`src/components/providers/`) — theme, session, query, socket
- **Layout** (`src/components/layout/`) — header, sidebar, nav, footer

## Database Architecture

- **ORM**: Prisma 6 with `driverAdapters` (`@prisma/adapter-pg`)
- **Provider**: PostgreSQL (`valet_monorepo` on localhost:5432)
- **Generated client**: `src/lib/db/generated/client`
- **Binary targets**: `native`, `rhel-openssl-3.0.x`
- **Tenant scoping**: `src/lib/db/tenant-scoping.ts` enforces organization-level data isolation automatically on tenant-scoped models
- **Key models**: User, Organization, OrganizationMembership, Session, OAuthAccount, MfaSecret/RecoveryCode, VerificationToken, PasswordResetToken, Role/Permission/RolePermission/UserRole (RBAC), PlatformRole/PlatformRolePermission/PlatformUserRole, Plan, Subscription, AddOn, ResourceType/ResourceUsageEvent, Invoice/CreditNote, ApiKey, NotificationKind/InAppNotification, AuditLog (immutable), Feature/OrganizationFeatureOverride/UserFeatureOverride, ProcessedWebhookEvent, Property/Zone/Driver/NfcCard/CardDeck/Offer/Order/DriverShift, DriverResetToken
- **Two separate RBAC systems** (FR-113): Platform roles (no orgId, Super Admin only) and Tenant roles (org-scoped, custom per org). Both share the global Permission catalog.
- **Immutability**: AuditLog, SubscriptionEvent enforced in tenant-scoping extension; Invoice mutable only in DRAFT state
- **Migrations**: 39 migrations, 1 pending (`20260910120000_orders_card_id_index`)

## Authentication Architecture

1. **Login**: email/password via `/api/auth/login` or OAuth (Google/Apple/Microsoft/PKCE)
2. **Session cookie**: `session_token` HttpOnly, 30-day default, managed by `src/lib/auth/session.ts`
3. **Identity resolution**: `src/lib/auth/current-user.ts` — `requireIdentity()`, `getSessionOrThrow()`
4. **MFA**: TOTP + backup codes (hashed)
5. **CAPTCHA**: Server-side verification in every mutation action; configurable provider
6. **Rate limiting**: per-email keys for signup/password-reset
7. **Password reset**: `PasswordResetToken` with hashed token, expiry, consumed on use
8. **OAuth**: `state` param + `redirectUri` + nonce + PKCE (`codeVerifier`/`codeChallenge`)

## Authorization Architecture

- RBAC via `Role`/`Permission`/`RolePermission`/`UserRole` (tenant) + `PlatformRole`/`PlatformRolePermission`/`PlatformUserRole` (platform)
- `src/lib/db/tenant-scoping.ts` — auto-scopes tenant models by `organizationId`
- Permission resolution in `authorization.ts` — checks "this org's role OR global role"
- `src/lib/group-permissions.ts` — group-level permission helpers
- Protected routes enforced server-side; 401 (`/unauthorized`) and 403 (`/forbidden`) pages

## API Architecture

- **Route handlers** under `src/app/api/` (Next.js 16 App Router routes)
- **v1 REST** (`/api/v1/`) — versioned platform API: members, invites, roles/assignments, sessions, settings, audit-logs, api-keys, features, billing (plans/usage/subscription/invoices), organization/export, notifications
- **Platform valet APIs** (`/api/platform/valet/`) — dashboard, drivers, locations, cards, offers, orders, queue, reports, print-profiles
- **Driver APIs** (`/api/driver/`) — dashboard, history, orders, profile, properties, queue, scan-plate, shift, push-token, notify-delay, login, forgot/reset-password
- **Public APIs** (`/api/public/`) — offer validate/menu, tap `[uid]`
- **Webhooks** (`/api/webhooks/stripe|paypal`) — idempotent via `ProcessedWebhookEvent`
- **Auth APIs** (`/api/auth/`) — login, logout, driver-login, driver forgot/reset-password
- **Mode** (`/api/mode`) — maintenance flag (used by proxy)
- **Cron** (`/api/cron/lifecycle-sweep`) — lifecycle sweep
- **Socket.IO** (v4 client + `ws` server) — real-time valet status, order updates, guest notifications; auth via `valet_ws_token`
- **WS server**: `ws-server.ts` (root) — standalone Socket.IO server separate from Next
