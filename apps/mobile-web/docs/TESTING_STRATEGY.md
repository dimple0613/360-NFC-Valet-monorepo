# TESTING_STRATEGY.md

## Current State

**No automated tests exist.** Verification today is:

- `npm run build` — production build (catches compile/import errors).
- `npm run lint` — ESLint.
- Manual smoke tests against the running stack (admin `:3000`, mobile web `:3001`, socket `:3002`):
  - landing → manual UID entry → card lookup
  - ETA request (stepper + preset chips) → live countdown → ready screen
  - WebSocket banner on a return-complete event
  - category browse → offer detail → staff-code validation (correct and wrong code)
  - no-car panel for an unlinked card; "card not recognised" for an unknown UID

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

- `lib/client.js` — non-2xx throws with `status`; body serialization; base URL from `NEXT_PUBLIC_ADMIN_API`.
- `components/TapApp.js` helpers — `carName`, `savePercent`, `openNow` (overnight hours), `mmss`/countdown math, `hoursText`.

### Component tests

- **Landing** — NFC unsupported shows manual entry; short UID disables submit; submit navigates to `/t/<uid>`.
- **Home** — renders property banner + car strip from mocked data; "no car" panel when `order` is null; ETA button opens the sheet.
- **EtaSheet** — stepper clamps 5–30; preset chips set the value; submit calls `POST` with `minutes`; busy state.
- **Status (C3)** — renders countdown + driver chip + 4 steps; hits 0 → ready view.
- **Listing / detail** — filters (All / Offers only / Open now); validation code entry success/error paths.
- **Ready (C4)** — shows pickup location; "I'm on my way" returns home.

### E2E (Playwright)

- Landing → manual UID → home → bring-my-car → countdown (mock the clock) → ready.
- Offer detail → staff-code validation success + failure.
- Unknown UID → "Card not recognised".

## CI note

Wire `lint` + `build` (and, once added, `test`) into a GitHub Actions workflow — see `docs/DEPLOYMENT.md` for a template. E2E runs against the real stack require the admin console + seeded DB, so keep them in a separate job with the admin repo checked out as well.