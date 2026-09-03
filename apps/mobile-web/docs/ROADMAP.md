# ROADMAP.md

Planned work for the 360 NFC Valet Mobile Web (guest tap page). Items marked ✅ are complete.

## Phase 1 — Foundation

- ✅ **1. Project scaffold** — Next.js 15 Pages Router + plain JS, design-system CSS, path alias `@/*`.
- ✅ **2. Card lookup** — UID from the URL (`/t/<uid>`), resolve via `GET /api/public/tap/[uid]`.
- ✅ **3. Landing screen** — Web NFC scan (`NDEFReader`) + manual card-number entry with validation.

## Phase 2 — Guest core flow

- ✅ **4. Home (C1)** — property banner, bring-my-car hero, car strip (card, plate, zone).
- ✅ **5. ETA sheet** — bottom sheet with 5–30 min stepper + preset chips; `POST /api/public/tap/[uid]`.
- ✅ **6. Live status (C3)** — countdown ring, driver chip, 4-step timeline (request → driver → on the move → ready).
- ✅ **7. Ready (C4)** — green "your car is ready" screen with pickup location.

## Phase 3 — Offers

- ✅ **8. Category grid + listing (C5)** — Dining/Spa/Gym/Fun/Stay/Deals with All / Offers-only / Open-now filters.
- ✅ **9. Offer detail (C6)** — price, save %, hours, "Call to reserve".
- ✅ **10. Staff validation** — 4-digit code entry via `POST /api/public/offer/validate`; success flips to "parking is on the house".

## Phase 4 — Real-time + hardening

- ✅ **11. WebSocket banners** — socket.io against `:3002`; parked / request-received / arrived / delay events with auto-refetch.
- ⚠️ **12. Automated tests** — strategy documented in `docs/TESTING_STRATEGY.md`; not yet implemented.
- ⚠️ **13. Error/empty polish** — "no car found" panel and "card not recognised" exist; more retry paths planned.

## Phase 5 — Deployment

- ✅ **14. Production build verified** — `npm run build` + `npm run start`.
- ⚠️ **15. Cloud hosting** — template CI in `docs/DEPLOYMENT.md`; Vercel is the likely choice.
- ❌ **16. HTTPS + custom domain** — required before Web NFC works on real phones.

## Phase 6 — Feature depth

- ❌ **17. Push notifications / background updates** — countdown relies on an open tab today.
- ❌ **18. Multi-language** — UI copy is English only.
- ❌ **19. Guest history** — "my past visits" per card (needs a storage strategy; the app has no on-device persistence).
- ⚠️ **20. Web NFC on iOS** — unavailable; manual entry remains the fallback.

## Immediate next steps

1. Add Jest + a first component test for `TapApp` (landing → lookup → ETA).
2. Deploy the admin API + this app to Vercel and wire `CORS_ORIGINS`.
3. Set up the WebSocket server on a stable host and make its URL configurable via env (not derived from the origin).