# Architecture

This document describes the high-level architecture of the **360 NFC Valet Mobile Web** app — the guest-facing tap page (Module 3).

## Overview

The mobile web is a **client-rendered Next.js (Pages Router) app** with no backend of its own. All data comes from the **admin console** (`../admin`, port `3000`) through its public, CORS-enabled endpoints; real-time order events come from a **WebSocket server** (socket.io, port configured via `NEXT_PUBLIC_WS_URL`).

```
Guest phone (browser) ──► mobile_web (3001) ──GET/POST──► admin API (3000) /api/public/*
        ▲                                                    │
        └──────────── CORS (middleware.js in admin) ──────────┘
        └──────────── WebSocket (NEXT_PUBLIC_WS_URL) — live order events ────┘
```

- **Pages** are thin wrappers that render `<TapApp />`.
- **`components/TapApp.js`** holds the whole app: view routing, state, socket wiring, and every screen.
- **`lib/client.js`** (`api()`, `adminUrl()`) is the only place `fetch` is called.
- **`styles/globals.css`** holds the design system as CSS custom properties (shared with the admin console).
- The **card UID** is the only credential — there is no login.
- The app polls the tap API every **15 seconds** as a fallback when WebSocket is unavailable.

## Directory Layout

```
mobile_web/
├── pages/
│   ├── index.js               # "/" — renders <TapApp /> (landing if no uid)
│   ├── [slug]/[uid].js        # "/<slug>/<uid>" — renders <TapApp /> (slug-based lookup)
│   ├── _app.js                # imports globals.css
│   ├── _document.js           # base <html>/<head> shell
│   └── 404.js                 # not-found page
├── components/
│   └── TapApp.js              # entire guest app (views, state, sockets)
├── lib/
│   └── client.js              # browser api() + adminUrl() wrappers → admin public API
├── styles/
│   └── globals.css            # design tokens + component styles
├── jsconfig.json              # path alias @/* -> project root
└── .env.local                 # NEXT_PUBLIC_ADMIN_API, NEXT_PUBLIC_WS_URL
```

## Design Rules

1. **No direct `fetch` in components** — use `api()` from `lib/client.js`. For full admin API URLs use `adminUrl()` from the same module.
2. **All data comes from the admin API** — the mobile app must never talk to a database.
3. **Never add auth/session logic here** — the app is public by design (see `AGENTS.md`).
4. **All views live in `components/TapApp.js`** — pages stay as one-line wrappers.
5. **Design tokens over hex** — reuse `--primary`, `--navy-2`, etc. from `globals.css`.
6. **Path alias `@/*`** maps to the project root (`jsconfig.json`).
7. **Plain JS** — no TypeScript in this project.

## View State

`TapApp` keeps a single `view` state object (`{ type }`) plus small UI flags:

| View | Trigger | Notes |
|---|---|---|
| `landing` | no UID in the URL | NFC scan |
| `loading` | UID present, fetch in flight | spinner |
| `error` | fetch failed | "Card not recognised" + retry |
| `home` | loaded | hero, car strip, categories, featured offers; "Visit complete" if order returned |
| `list` | category tapped | filter chips (All / Offers only / Open now) |
| `detail` | offer tapped | price, save %, hours, optional menu link, validation code, call-to-reserve |
| `status` | bring-my-car active | countdown ring + timeline |
| `ready` | countdown hit 0 (or order `returned`) | green "your car is ready" |

Request state is tracked as `request` (`{ eta, minutes }`) — the countdown runs from `request.eta` against a 1s `useNow` clock; when it reaches 0 the app switches to the `ready` view.

Countdown surfaces (`status-count` on the status hero, the header `pill-eta`/`pill-eta-glass`, and the `status` view ring) only render while the timer is actually running (`leftMs > 0`). With no ETA yet (`leftMs == null`) or once the ETA is reached/overdue (`leftMs == 0`) they fall back to the `head-spacer` (hero/header) or a non-numeric ring label (`Now`, `waiting for driver ETA`) instead of a misleading `00:00`.

The ETA sheet auto-opens when the user lands on the home view with an active/parked order and no request in progress.

## Data Flow

```
components/TapApp.js → lib/client api() → admin API /api/public/tap/[uid] → Postgres
        ▲                                                                 │
        │                          JSON (card, property, order, offers)    │
        └──────────────────────────────────────────────────────────────────┘
```

1. On mount (or when the UID changes), `TapApp` calls `api("/public/tap/<uid>")`.
2. `api()` throws `Error` with a `status` property on non-2xx — the app shows the error view.
3. The admin API resolves the card → property (with optional `imageUrl`) + latest order + live offers (with optional `imageUrl`/`menuUrl`, featured first).
4. `POST /public/tap/<uid>` with `{ minutes }` starts the bring-my-car flow and returns `{ eta, minutes }`.
5. `POST /public/offer/validate` with `{ offerId, code }` or `{ propertyId, code }` validates a staff code (success flips the UI to "parking is on the house").
6. The app polls the tap endpoint every **15 seconds** to keep the UI in sync.

## Real-time updates (WebSocket)

- Once data loads, `TapApp` connects to the URL in `NEXT_PUBLIC_WS_URL` via `socket.io-client` (if the env var is set; otherwise WebSocket is disabled and the app relies on 15s polling).
- It subscribes to the property (`subscribe:property`) and listens for `valet.order.parked`, `valet.order.return.requested`, `valet.order.completed`, and `valet.delay.notified`.
- Matching events show a toast banner and bump `fetchKey`, which re-runs the tap fetch so the UI reflects the server state.

## Authentication

- **None.** The card UID is the identity. Offer validation is the only gated action and uses a per-offer staff code checked server-side — the code never reaches this app.

## Database

The mobile app has **no database**. Schema and seed live in the admin console (`../admin/db/schema.sql`, `db/seed.js`). See [docs/DATABASE.md](./docs/DATABASE.md) for the tables the public endpoints read (`nfc_cards`, `properties`, `orders`, `offers`, `drivers`).

## Related Docs

- [PROJECT.md](./PROJECT.md) — project overview and implementation status
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) — public endpoint catalog
- [docs/DATABASE.md](./docs/DATABASE.md) — schema & data (owned by the admin console)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — local dev + production
- [docs/ROLES_AND_PERMISSIONS.md](./docs/ROLES_AND_PERMISSIONS.md) — guest/staff access
- [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) — test plan
- [docs/ROADMAP.md](./docs/ROADMAP.md) — planned work

## Scaling Notes

- **State:** single-component state in `TapApp` is fine at this size. If screens grow, lift state into a small context or custom hook — not needed yet.
- **Theming:** add new tokens as CSS variables in `styles/globals.css`.
- **Testing:** add Jest + React Testing Library when view logic grows (see `docs/TESTING_STRATEGY.md`).