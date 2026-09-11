# 360 NFC Valet — Web

Next.js 16 SaaS platform powering 360 Valet NFC valet-parking operations. Multi-tenant (Super Admin + Tenant Admin), deployed to Cloudflare Workers via OpenNext.

## Purpose

Platform core for managing valet properties, drivers, NFC cards, guest tap-in, orders, offers, billing, and platform-wide RBAC.

## Tech Stack

- **Next.js 16.3** App Router, React 19, TypeScript strict
- **Prisma 6** + PostgreSQL (`@prisma/adapter-pg` driver adapter)
- **Tailwind CSS 4** + shadcn/ui + Formik + Yup validation
- **Auth**: custom cookie sessions, OAuth (Google/Apple/Microsoft/PKCE), MFA TOTP, CAPTCHA server-side, rate limiting
- **Payments**: Stripe + PayPal webhooks/checkout
- **Real-time**: Socket.IO + `ws`
- **Cache/Queue**: ioredis, Upstash queue/workflow
- **Tests**: Vitest
- **Deploy**: Cloudflare Workers (OpenNext); Vercel fallback

## Quick Start

Create `.env` from the template and fill required vars, then:

```bash
npm run dev            # localhost:3000
```

## Commands

| Command | What |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate && next build` |
| `npm start` | Production server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run prisma:generate` | Regenerate client |
| `npm run prisma:migrate` | Dev migration |
| `npm run prisma:deploy` | Apply pending migrations |
| `npm run db:seed` | Seed seed data + 28 permissions |
| `npm run pages:build/preview/deploy` | OpenNext build/preview/deploy |

## Env Vars (names only — no secrets here)

`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `SUPER_ADMIN_EMAIL`, `CRON_SECRET`, `CAPTCHA_*`, `GOOGLE_*`, `APPLE_*`, `MICROSOFT_*`, `SMTP_*`, `STRIPE_*`, `PAYPAL_*`, `TWILIO_*`, `ANPR_*`, `MAPBOX_*`, `APP_URL`, `NEXT_PUBLIC_WS_URL`, `CLOUDFLARE_*`, `WOOTCOM_*`, `MIXPANEL_*`

## Project Structure

```
src/
  app/                  # App Router pages + routes
    (auth)/             # Login / signup / MFA / forgot-password / invite / select-plan
    api/                # Route handlers (auth, driver, platform, v1 REST, webhooks, public)
    super-admin/        # Platform admin dashboard & settings
    tenant-admin/       # Org admin dashboard (valets, guests, orders, cards, coupons, reports)
    [tenant]/           # Guest-facing tenant portal (check-in/out, reservations, profile)
    maintenance/        # Maintenance-mode page
  components/           # UI (shadcn), forms, layout, auth, dashboard, orders, cards, payments
  lib/                  # Auth, DB (Prisma + tenant-scoping), tenant helpers, config, utils, services, hooks
prisma/                 # Schema + 39 migrations + seed
src/lib/db/__tests__/   │ DB layer tests
```

## Deeper Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architecture, data flow, auth, RBAC, APIs
- [AGENTS.md](./AGENTS.md) — Agent rules, conventions, pitfalls
- [DEVELOPMENT.md](./DEVELOPMENT.md) — Dev setup, DB, migrations, testing
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — Detailed file/folder responsibilities
