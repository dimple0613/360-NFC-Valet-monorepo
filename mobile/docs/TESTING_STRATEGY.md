# TESTING_STRATEGY.md

## Current State

**No automated tests exist.** Verification today is:

- `npm run build` — production build (catches compile/import errors).
- `npm run lint` — ESLint.
- Manual smoke tests against the running stack (admin `:3000`, mobile web `:3001`, WebSocket via `NEXT_PUBLIC_WS_URL`):
  - landing → NFC tap (card UID) → card lookup
  - `/<slug>/<uid>` route → same lookup flow
  - ETA request (stepper + preset chips) → live countdown → ready screen
  - WebSocket banner on a return-complete event (or 15s polling fallback)
  - category browse → offer detail (with optional image/menu link) → staff-code validation (property-level, correct and wrong code)
  - no-car panel for an unlinked card; "card not recognised" for an unknown UID
  - "Visit complete" panel for a returned order

## Target (per PROJECT.md)

- Unit tests for `lib/` helpers (client `api()` wrapping, `savePercent`/`openNow`/`carName` formatters, countdown math).
- Component tests for the views in `TapApp` (landing, home, status, listing, detail, ready, error).
- E2E tests for critical flows (landing → lookup → bring-my-car → countdown → validate).

## Proposed Stack

| Layer | Tool | Purpose |
|---|---|---|
| Test runner | Jest (`jest-environment-jsdom`) | Unit + component tests |
| Component | React Testing Library | `TapApp` view rendering + interactions |
| E2E | Playwright | Critical guest flows against the running stack |

> `TapApp` depends on `next/router` and `socket.io-client`. Mock `useRouter` and the socket factory in component tests; the admin API calls go through `lib/client.js`, which can be mocked at module level.

## Suggested scripts

```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

## Test plan map

### Unit tests

- `lib/client.js` — non-2xx throws with `status`; body serialization; base URL from `NEXT_PUBLIC_ADMIN_API`; `adminUrl()` produces correct full URLs.
- `components/TapApp.js` helpers — `carName`, `savePercent`, `openNow` (overnight hours), `mmss`/countdown math, `hoursText`, `normalizeSerial` (hex NFC serial conversion).

### Component tests

- **Landing** — NFC unsupported shows "NFC not available" notice; (manual entry was removed); card scan navigates to `/<slug>/<uid>`.
- **Home** — renders property banner (with optional image) + car strip from mocked data; "no car" panel when `order` is null; "visit complete" panel when order is returned; ETA button opens the sheet; auto-opens ETA for active/parked orders.
- **EtaSheet** — stepper clamps 5–30; preset chips set the value; submit calls `POST` with `minutes`; busy state.
- **Status (C3)** — renders countdown + driver chip + 4 steps; hits 0 → ready view.
- **Listing / detail** — filters (All / Offers only / Open now); offer images; menu link; validation code entry success/error paths (property-level).
- **Ready (C4)** — shows pickup location; "I'm on my way" returns home.
- **Slug routing** — `/<slug>/<uid>` renders the same TapApp flow.

### E2E (Playwright)

- Landing/NFC tap, `/<slug>/<uid>` → home → bring-my-car → countdown (mock the clock) → ready.
- Slug route: `/some-slug/<uid>` → same flow.
- Offer detail → staff-code validation success + failure (property-level).
- Unknown UID → "Card not recognised".
- Returned order → "Visit complete" panel.

## CI note

Wire `lint` + `build` (and, once added, `test`) into a GitHub Actions workflow — see `docs/DEPLOYMENT.md` for a template. E2E runs against the real stack require the admin console + seeded DB, so keep them in a separate job with the admin repo checked out as well.