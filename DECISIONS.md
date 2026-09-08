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

## D-005: Valet card identity — `uid` is the stable public card identifier

**Decision (audit #16):** A valet card's `nfc_cards.uid` string (pool serial, e.g. `MQZ-001`, dev seed `7001`) **is** the card's physical/public identity. It is the NFC tag's carried identifier, the guest page contract `/t/<uid>`, the driver order-binding key when a number is entered, and the payload of the printed QR. `physical_uid` and `card_number` are **optional alias lookup columns** to which a future raw hardware-serial (real NDEF/tag serial) can be bound; they are deliberately unpopulated today — both the guest tap route (`web/src/app/api/public/tap/[uid]/route.ts`: `WHERE c.uid = $1 OR UPPER(c.physical_uid) = UPPER($2)`) and the driver create route already resolve either, so wiring raw serials later is pure data-population with no schema/route change.

**Why:** Collision safety is enforced at the persistence gate, not by naming: `uid` has a UNIQUE constraint and `registerCards` (`web/src/app/tenant-admin/_lib/valet-data.ts`) globally rejects a registered range that clashes with any existing UID, while `nextUidStart()` (`web/src/app/tenant-admin/_lib/uid.ts`) suggests global `MAX(numeric uid) + 1` starts. Different properties' ranges may *look* overlapping, but prefixes (3 letters) disambiguate, and same-prefix overlaps are refused at registration. Card resolution on the read path is intentionally status-agnostic — a known card always renders the guest page (blocked/lost gating stays on the write path where an order/return is actually created).

**Does not lock in:** Whether a future physical-serial binding makes `physical_uid` the NDEF payload or the tag's raw UID; whether `card_number` becomes a human-facing printed label distinct from `uid`. Either is achievable by populating those columns.
