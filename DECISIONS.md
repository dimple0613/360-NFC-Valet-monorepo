# Decisions

Lightweight decision log for choices `REQUIREMENTS.md` leaves open. Each entry records what was decided, why, and what it does *not* lock in (since the core architecture must stay provider/tooling-agnostic per FR-140–FR-144).

## D-001: Monorepo tooling — Turborepo + pnpm

**Decision:** Use Turborepo for task orchestration/caching and pnpm as the package manager, workspaces at `web/`, `packages/*`, `plugins/*`, `mobile/`.

**Why:** Standard, low-friction pairing for a Next.js-centric monorepo; incremental/remote caching matters once `packages/` and `plugins/` multiply. Matches the `packages/` + `plugins/` layout already specified in REQUIREMENTS.md §5.

**Does not lock in:** Nothing plugin-facing — module/plugin authors never need to know the monorepo tool; it only affects core repo development.

## D-002: Deployment target — Vercel (app) + Neon (database)

**Decision:** Primary deployment target for Phase 1 is Vercel for the Next.js app and Neon for PostgreSQL, matching REQUIREMENTS.md §5's stated production assumption.

**Why:** Zero extra infra to stand up before there's a product to deploy; Neon's branching model is convenient for preview environments per PR.

**Does not lock in:** All config is environment-variable driven (per NFR/Assumptions), so self-hosted/Docker deployment remains possible later without code changes — this is a default, not a hard dependency.

## D-003: Auth — local email+password + MFA first

**Decision:** Phase 1 implements only the Local Authentication provider (email+password) plus MFA (TOTP + recovery codes), built behind the same auth-provider adapter contract that OAuth2/SAML/LDAP/social providers will later implement (FR-220–FR-223).

**Why:** Fastest path to a testable, end-to-end tenant + user flow. Building the adapter contract now (even with one implementation) avoids having to retrofit it when the second provider is added.

**Does not lock in:** Provider list or order for Phase 2+; any provider from FR-220 can be added without touching core auth flow, only a new adapter.

## D-004: Phase 1 scope — Foundation + Billing

**Decision:** Phase 1 covers both the tenancy/auth/RBAC foundation AND subscriptions/plans/one payment provider (Stripe), rather than foundation alone. See `ROADMAP.md` for the breakdown.

**Why:** A SaaS boilerplate without any billing path is hard to validate end-to-end (can't test plan-gated features, resource quotas tied to plans, or upgrade/downgrade flows) — bringing billing into Phase 1 lets the multi-tenancy + RBAC + resource-quota systems be exercised together instead of retrofitted.

**Does not lock in:** Only Stripe is implemented first; the payment-provider adapter contract (FR-210–FR-213) is built so Razorpay/Paddle/etc. are pure additions later.
