# Roadmap

Phased build order bridging `REQUIREMENTS.md` (the full spec, FR-100–FR-322) to an actual implementation sequence. Decisions behind this phasing are in `DECISIONS.md`. This is a living document — re-order/re-scope phases as reality intervenes.

Everything not listed under Phase 1 is explicitly deferred, not forgotten — see "Deferred to later phases" at the bottom, which maps directly back to REQUIREMENTS.md sections so nothing gets lost.

## Phase 0 — Scaffold & environment

Prerequisite plumbing before any feature code. No business logic yet.

- Turborepo + pnpm workspace: `web/`, `packages/`, `plugins/`, `mobile/` (stub only)
- `web/`: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui, empty shell app
- Prisma set up against local PostgreSQL; Neon connection for a deployed environment
- Redis wired for cache/queue (local + hosted)
- Environment variable scaffolding (`.env.example`) covering DB, Redis, auth secrets, Stripe keys — nothing hardcoded per FR-144
- CI pipeline (lint, typecheck, test, build) on PRs
- Vercel project + Neon database provisioned, preview deployments per branch

## Phase 1A — Multi-tenancy & platform foundation

Corresponds to REQUIREMENTS.md §2.1, §2.2, §2.3, §2.4, §2.6, §2.18, §2.19.

- Organization (tenant) model + flat membership (FR-106) — a nested teams/workspaces sub-structure was originally built here and later removed as unnecessary complexity, see TASKS.md
- Tenant context resolution: session-based for web, header/token for API (FR-103)
- Automatic tenant scoping at the persistence layer (Prisma middleware/extension + repository layer) — never per-controller (FR-101, FR-102)
- Cross-tenant access returns 404 + audit log entry (FR-104)
- Organization CRUD lifecycle: create, suspend, reactivate, archive, delete-with-grace-period (FR-132) + lifecycle events on an event bus (FR-133)
- RBAC core: roles-as-data, platform RBAC distinct from tenant RBAC (FR-113, FR-150), permission registry, server-side policy enforcement (FR-153)
- Settings service skeleton: platform/org/user scopes with inheritance (FR-270, FR-271)
- Audit logging skeleton: immutable records, actor/org/module/before-after capture (FR-280, FR-282)
- Super Admin portal shell: organization list/detail, platform admin management, impersonation (time-boxed, audited) (FR-110–FR-113)
- Tenant Admin portal shell: org profile, users, custom role builder foundation (FR-120–FR-122)

## Phase 1B — Auth & sessions

Corresponds to REQUIREMENTS.md §2.13.

- Auth provider adapter contract (interface first, so future providers are pure additions)
- Local authentication provider: email + password (FR-220)
- MFA: TOTP + recovery codes (FR-222)
- Session management: active session/device list, revocation, configurable lifetimes (FR-223)

## Phase 1C — Billing foundation

Corresponds to REQUIREMENTS.md §2.7, §2.8, §2.9, §2.10, §2.11, §2.12 (Stripe only).

- Resource management engine: registry-based resource types, no schema changes to add a type (FR-170–FR-173)
- Plan model: pricing, billing cycle, features, resources, versioning (existing subscribers stay on their version) (FR-180–FR-183)
- Subscription model: full lifecycle (create/renew/pause/resume/cancel/upgrade/downgrade) (FR-160–FR-163)
- Feature flags: global → plan → org → user precedence, cached (FR-190–FR-192)
- Payment provider adapter contract + Stripe adapter implementation (FR-210–FR-213), signature-verified idempotent webhooks
- Invoices: immutable once issued, corrections via credit notes (FR-200, FR-201); single currency acceptable for Phase 1, multi-currency plumbing left ready (FR-202)

## Definition of done for Phase 1

- A new organization can sign up, an admin can log in with MFA, invite a user, assign a custom role, subscribe to a paid plan via Stripe, and see that resource quota enforced — all without leaking data to another tenant, and every step audit-logged.
- Tenant isolation regression suite passing (NFR-9).
- OpenAPI docs exist for whatever REST endpoints Phase 1 ships (NFR-10).

## Deferred to later phases (not forgotten — tracked against REQUIREMENTS.md)

- **Module/plugin registry & marketplace mechanics** — §2.5 (FR-140–FR-144)
- **Additional auth providers** (OAuth2/OIDC/SAML/LDAP/AD/Entra/social/passkeys/magic links) — §2.13 (FR-220–FR-221)
- **Additional payment providers** (Razorpay, Paddle, Lemon Squeezy, PayPal, Braintree, Authorize.Net, Square, bank transfer, crypto) — §2.12 (FR-211)
- **Notification framework** (email/SMS/push/WhatsApp/Slack/Teams/Discord/Telegram/in-app/webhooks) — §2.14
- **Integration framework** (ERP/CRM/accounting/search/analytics adapters) — §2.15
- **Localization** (multi-language, RTL, locale fallback chain) — §2.16
- **Tax management engine** (VAT/GST/regional rules/exemptions) — §2.17
- **Reporting engine** (report builder, scheduled exports) — §2.20
- **Dynamic dashboards** (widget system, per-role/per-user layouts) — §2.21
- **Full UI standards polish** (saved views, bulk actions, column selection, import/export on every list) — §2.22
- **Full API surface** (SDK generation, full CRUD across every resource) — §2.23, beyond the minimum Phase 1 needs. Partially landed post-Phase-1: real API key auth with scopes and per-key rate limits (FR-322), and the first two versioned `/api/v1` routes — see `TASKS.md`'s "Post-Phase-1" section.
- **Mobile app** — scaffolding only in Phase 0, no features
