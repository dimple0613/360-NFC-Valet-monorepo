# PROJECT.md - Project Overview

## Project Overview

360 NFC Valet Mobile Web is the **guest-facing tap page (Module 3)**: a mobile-first web app that opens on a guest's phone when they tap an NFC-tagged valet card. It is built with Next.js (Pages Router), React 19, and plain JavaScript, and runs on port `3001`.

**Status: Implemented (v1)** — the app resolves a card UID, shows the property, lets the guest request their car back with a live countdown, and surfaces live hotel offers with a staff-code validation flow. Real-time order updates arrive over WebSocket (socket.io, port `3002`).

## Project Goals

- Let a guest get their car back without calling or visiting the valet desk — tap the card, pick an ETA, done.
- Show live, real-time status of the return request (request received → driver assigned → on the move → ready at the curb).
- Surface the property's offers (featured first, category-filtered) and let staff validate valet-parking offers with a 4-digit code.
- Work with zero install: no app store, no login, no account.

## Target Users

- Hotel/restaurant guests holding an NFC valet card.
- Valet staff who validate offers at the outlet (they enter the staff code).

## Core Features

- **Landing** — NFC scan (Web NFC / `NDEFReader` on Android Chrome) or manual card-number entry; looks up the card by UID.
- **Home (C1)** — property banner, "Bring my car" hero, car strip (card, plate, zone), category grid, featured offers row.
- **Bring my car (ETA sheet)** — bottom sheet with a 5–30 min stepper + preset chips; POSTs to the public tap API.
- **Live status (C3)** — countdown ring, driver chip, 4-step timeline (request → driver → on the move → ready), WebSocket live updates.
- **Ready (C4)** — green "your car is ready" screen with pickup location.
- **Offers (C5)** — category listing with All / Offers-only / Open-now filters.
- **Offer detail (C6)** — price, save %, hours, staff validation code entry, "Call to reserve".
- **WebSocket banners** — parking / request-received / arrived / delay events show as live toast banners.

## Application Structure

Follows a **Pages Router** layout with a single shared component:

```
pages/          thin page wrappers (all render <TapApp />)
components/     TapApp.js — the entire guest app (views, state, sockets)
lib/            client.js — browser fetch wrapper (api())
styles/         design system (globals.css)
```

- **Pages** only import and render `TapApp`; the UID is read from the URL (`/t/<uid>`, `/t/`, or `/?uid=<uid>`).
- **`lib/client.js`** is the only place `fetch` is called — it talks to the **admin console's** public API (`NEXT_PUBLIC_ADMIN_API`, default `http://localhost:3000/api`).
- **No local database** — all data comes from the admin console's public `/api/public/*` endpoints (CORS-enabled for this app's origin).

## Authentication Requirements

- **No guest authentication.** The tap page is deliberately public — the card UID is the credential.
- Offer validation uses a per-offer **staff code** (`staff_code`, 4 digits) checked server-side by `POST /api/public/offer/validate`; the code itself is never returned to the client.

## Roles and Permissions

- **Guest** — can look up a card, request their car, browse offers, and see live status.
- **Staff** — anyone holding the staff validation code can validate a valet offer.
- There is no account system; authorization is entirely server-side on the admin API (see the admin `ROLES_AND_PERMINS.md` and this folder's `docs/ROLES_AND_PERMISSIONS.md`).

## UI Requirements

- Mobile-first, single-column, bottom-sheet and ring-countdown UI built with plain CSS in `styles/globals.css`.
- Loading, empty, and error states on every data view (spinner, "no car" panel, "card not recognised").
- Design tokens as CSS variables (`--primary`, `--navy-2`, …) shared with the admin console.
- Web NFC scan icon pulses while scanning; a fallback manual entry is always available.

**Status: Implemented**

## Security Requirements

- No secrets in the repo (`.env.local` gitignored; `.env.local.example` is the template).
- Only the **public** endpoints are reachable from this app; admin routes stay session-protected on the admin console.
- Staff codes are compared server-side and never exposed.
- HTTPS required in production (Web NFC is only available on secure contexts).

**Status: Implemented**

## Testing Requirements

- Build + lint gate (`npm run build`, `npm run lint`).
- Manual smoke tests: landing → manual lookup → tap with real UID → ETA request → live countdown → offer browse → staff-code validation.

**Status: Smoke-tested end-to-end.** Automated tests are planned (see `docs/TESTING_STRATEGY.md`).

## Deployment Requirements

- Local dev: admin console on `:3000`, mobile web on `:3001`, WebSocket server on `:3002`.
- Production: `npm run build` + `npm run start`, with `NEXT_PUBLIC_ADMIN_API` pointing at the deployed admin API.
- See `docs/DEPLOYMENT.md`.

**Status: Local production build verified.**

## Decisions Required

- Card lookup strategy for offline/no-card flows (manual entry only today; Web NFC is Android-only).
- Multi-language support (UI copy is English).
- Push notifications vs in-page polling for the return status when the tab is backgrounded.
- Deployment host for both the admin API and this app (Vercel / VPS).

---

## Related Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — folder structure, data flow, conventions
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) — endpoint catalog (public endpoints)
- [docs/DATABASE.md](./docs/DATABASE.md) — schema & data (owned by the admin console)
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — local dev + production
- [docs/ROLES_AND_PERMISSIONS.md](./docs/ROLES_AND_PERMISSIONS.md) — guest/staff access
- [docs/TESTING_STRATEGY.md](./docs/TESTING_STRATEGY.md) — test plan
- [docs/ROADMAP.md](./docs/ROADMAP.md) — planned work

## Implementation Status (Current State)

> This section tracks how far the codebase matches the specification above.

### Legend

- ✅ **Done** — implemented and functional
- ⚠️ **Partial** — partially implemented
- ❌ **Missing** — not implemented / deviates from spec

### Screens / Views

| Requirement | Status | Notes |
|---|---|---|
| Landing (NFC scan + manual entry) | ✅ | `NDEFReader` on Android Chrome; manual fallback always available |
| Home (C1) | ✅ | Property banner, bring-my-car hero, car strip, categories, featured offers |
| ETA sheet | ✅ | 5–30 min stepper + preset chips |
| Live status (C3) | ✅ | Countdown ring, driver chip, 4-step timeline |
| Ready (C4) | ✅ | Green ready screen with pickup location |
| Offers listing (C5) | ✅ | All / Offers only / Open now filters |
| Offer detail (C6) | ✅ | Price, save %, hours, staff validation, call to reserve |
| Error / empty states | ✅ | Spinner, no-car panel, card-not-recognised |

### API consumption

| Requirement | Status | Notes |
|---|---|---|
| `GET /public/tap/[uid]` | ✅ | Resolves card → property, order, offers |
| `POST /public/tap/[uid]` | ✅ | Bring-my-car (ETA) |
| `POST /public/offer/validate` | ✅ | Staff-code validation |
| Real-time WebSocket | ✅ | socket.io-client against `:3002`; banners on order events |

### UI

| Requirement | Status | Notes |
|---|---|---|
| Design tokens | ✅ | `styles/globals.css` shared with admin |
| Loading / empty / error states | ✅ | Every data view |
| Bottom sheets + ring countdown | ✅ | Pure CSS |
| Web NFC | ⚠️ | Android Chrome only; graceful fallback |

### Testing & Deployment

| Requirement | Status |
|---|---|
| `npm run build` | ✅ |
| `npm run lint` | ✅ |
| Smoke tests (lookup → ETA → offers → validate) | ✅ |
| Automated unit/integration tests | ❌ |
| Production hosting | ⚠️ Local `next start` verified; cloud pending |

## Known Deviations

1. **Web NFC** requires a secure context and Chrome on Android; iOS falls back to manual entry.
2. **No persistence on-device** — everything is server state on the admin console; reloading re-fetches.
3. **The WebSocket server (`:3002`) is not part of this repo** — it runs separately (see `docs/DEPLOYMENT.md`).