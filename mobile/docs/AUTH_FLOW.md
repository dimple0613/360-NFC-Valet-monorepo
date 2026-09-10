# AUTH_FLOW.md - Authentication Flows

## Current State

**None by design.** The mobile web app is **deliberately public** — a guest's card UID is the only credential, and there is no session, cookie, or login anywhere in this app. Server-side auth stays on the admin console (`../admin`, see its `docs/AUTH_FLOW.md`).

## Flow

1. A guest taps an NFC-tagged valet card (the landing is NFC-scan only — manual card-number entry was removed).
2. The app reads the UID from the URL (`/<slug>/<uid>` or `/?uid=<uid>`).
3. `GET /api/public/tap/[uid]` resolves the UID to a card → property + order + offers.
4. To get the car back, `POST /api/public/tap/[uid]` with `{ minutes }` flips the card's parked order to `returning` and stamps `guest_eta` — no authentication involved.
5. Offer validation is the only gated action: the guest's server (staff) enters a 4-digit **staff code**, verified server-side by `POST /api/public/offer/validate`.

## Staff code validation

- Each offer that validates valet parking has a `staff_code` (4 digits) stored in the `offers` table.
- The code is **never returned** by any endpoint — `POST /api/public/offer/validate` only ever answers `{ ok: true, validated: true }` or `{ ok: false, validated: false, error: "Incorrect staff code" }`.
- The mobile app treats validation as a boolean: on success the detail view flips to "Valet validated — parking is on the house".
- **Current state:** the offer-level validation box is wrapped in `display: "none"` in the offer detail view, so only the property-level validation box (shown on the home/status views when `property.validatesValet && property.hasCode`) is visible to guests.

## Security notes

- Card UIDs are identifiers, not secrets — never treat them as authorization for admin actions.
- Web NFC (`NDEFReader`) only works on a **secure context** (HTTPS or `localhost`) in Chrome on Android.
- Production must be served over HTTPS.