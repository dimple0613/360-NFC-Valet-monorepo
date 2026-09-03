# Architecture

This document describes the high-level architecture of the **360 NFC Valet Mobile Web** app — the guest-facing tap page (Module 3).

## Overview

The mobile web is a **client-rendered Next.js (Pages Router) app** with no backend of its own. All data comes from the **admin console** (`../admin`, port `3000`) through its public, CORS-enabled endpoints; real-time order events come from a **WebSocket server** (socket.io, port `3002`).

```
Guest phone (browser) ──► mobile_web (3001) ──GET/POST──► admin API (3000) /api/public/*
        ▲                                                    │
        └──────────── CORS (middleware.js in admin) ──────────┘
        └──────────── WebSocket (3002) — live order events ────┘
```

- **Pages** are thin wrappers that render `<TapApp />`.
- **`components/TapApp.js`** holds the whole app: view routing, state, socket wiring, and every screen.
- **`lib/client.js`** (`api()`) is the only place `fetch` is called.
- **`styles/globals.css`** holds the design system as CSS custom properties (shared with the admin console).
- The **card UID** is the only credential — there is no login.

## Directory Layout

```
mobile_web/
├── pages/
│   ├── index.js               # "/" — renders <TapApp /> (landing if no uid)
│   ├── t/index.js             # "/t" — renders <TapApp />
│   ├── t/[uid].js             # "/t/<uid>" — renders <TapApp /> (card lookup)
│   ├── _app.js                # imports globals.css
│   ├── _document.js           # base <html>/<head> shell
│   └── 404.js                 # not-found page
├── components/
│   └── TapApp.js              # entire guest app (views, state, sockets)
├── lib/
│   └── client.js              # browser api() wrapper → admin public API
├── styles/
│   └── globals.css            # design tokens + component styles
├── jsconfig.json              # path alias @/* -> project root
└── .env.local.example         # NEXT_PUBLIC_ADMIN_API template
```

## Design Rules

1. **No direct `fetch` in components** — use `api()` from `lib/client.js`.
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
| `landing` | no UID in the URL | NFC scan + manual entry |
| `loading` | UID present, fetch in flight | spinner |
| `error` | fetch failed | "Card not recognised" + retry |
| `home` | loaded | hero, car strip, categories, featured offers |
| `list` | category tapped | filter chips (All / Offers only / Open now) |
| `detail` | offer tapped | price, save %, hours, validation code, call-to-reserve |
| `status` | bring-my-car active | countdown ring + timeline |
| `ready` | countdown hit 0 (or order `returned`) | green "your car is ready" |

Request state is tracked as `request` (`{ eta, minutes }`) — the countdown runs from `request.eta` against a 1s `useNow` clock; when it reaches 0 the app switches to the `ready` view.

## Data Flow

```
components/TapApp.js → lib/client api() → admin API /api/public/tap/[uid] → Postgres
        ▲                                                                 │
        │                          JSON (card, property, order, offers)    │
        └──────────────────────────────────────────────────────────────────┘
```

1. On mount (or when the UID changes), `TapApp` calls `api("/public/tap/<uid>")`.
2. `api()` throws `Error` with a `status` property on non-2xx — the app shows the error view.
3. The admin API resolves the card → property + latest order + live offers (featured first).
4. `POST /public/tap/<uid>` with `{ minutes }` starts the bring-my-car flow and returns `{ eta, minutes }`.
5. `POST /public/offer/validate` with `{ offerId, code }` validates a staff code (success flips the UI to "parking is on the house").

## Real-time updates (WebSocket)

- Once data loads, `TapApp` connects to `ws://<origin with :3002>` via `socket.io-client`.
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