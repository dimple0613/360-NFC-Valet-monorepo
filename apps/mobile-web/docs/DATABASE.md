# DATABASE.md - Database Reference

## Overview

The mobile web app has **no database of its own**. It reads and writes the **admin console's** PostgreSQL database (`360nfc_valet`) through the admin's public API endpoints. The schema, seeder, and connection layer all live in `../admin` (`db/schema.sql`, `db/seed.js`, `db/reset.js`, `lib/db.js`).

- **PostgreSQL 18** (Laragon) on `localhost:5432`, database `360nfc_valet`.
- Connection string from `DATABASE_URL` (admin `.env`), default `postgresql://postgres@localhost:5432/360nfc_valet`.

## Tables the public tap endpoints read/write

### `nfc_cards`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `uid` | text | unique identifier printed on the card — the mobile app's key |
| `property_id` | int FK → properties | |
| `status` | text | `ready` / `with_guest` / `blocked` |
| `uses_count` | int | lifetime activations |

### `properties`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text UNIQUE | shown in the C1 banner + hero |
| `area` / `city` | text | hero subtitle |
| `slug` | text UNIQUE | guest page URL (`tap.360valet.ae/<slug>`) |
| `phone` | text | "Call to reserve" on the offer detail |
| `zones_count` / `slots_count` / `card_pool` | int | layout + pool size |
| `uid_start` | bigint | first card UID (real NFC UIDs exceed int — must stay BIGINT) |

### `orders`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `property_id`, `card_id`, `driver_id` | FK | |
| `plate`, `car_make`, `car_model`, `car_color` | text | shown on the car strip |
| `zone` / `slot` | text / int | pickup location on the ready screen |
| `status` | text | `active` / `parked` / `retrieving` / `returning` / `returned` |
| `created_at` | timestamptz | drop-off time |
| `guest_eta` | timestamptz nullable | when the guest asked the car to be ready (set by `POST /api/public/tap/[uid]`) — drives the countdown |
| `returned_at` | timestamptz nullable | return time |

### `offers`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `property_id` | int FK → properties | |
| `title`, `category`, `description` | text | category drives filter + gradient |
| `price` | numeric | current price |
| `was_price` | numeric nullable | original price (drives the "SAVE %" badge) |
| `rating` | numeric(2,1) nullable | guest rating on offer cards |
| `reviews` | int | review count |
| `level` | text nullable | "Level 1", "All-Day", … |
| `opens_at` / `closes_at` | time nullable | operating hours ("Open till 4 PM", "Open now" filter) |
| `deal_tag` | text nullable | badge label such as "FRIDAY ONLY" |
| `staff_code` | text nullable | secret code used only by `POST /api/public/offer/validate`; never returned by any endpoint |
| `featured` | int nullable | featured slot # (featured offers render first on home) |
| `live` / `draft` | boolean | visibility (only live, non-draft are served) |
| `validates_valet` | boolean | enables the staff-code validation box |

### `drivers`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `full_name`, `initials`, `avatar_color` | text | driver chip on the C3 status view |
| `property_id` | int FK → properties | |

## Key queries used behind the public endpoints

- **Tap lookup** — `nfc_cards` by `uid` → its `property` + latest `active`/`parked`/`retrieving`/`returning` order (with assigned driver) + live, non-draft `offers` for that property (featured first).
- **Bring my car** — update the card's latest order to `status='returning'` with `guest_eta = now() + minutes`.
- **Validate offer** — compare the posted `code` with `offers.staff_code`.

## Seeding

- Admin console's `db/seed.js` is idempotent and seeds 3 properties, 22 drivers, 22 offers, and 7 days of orders + validations (~1,550 orders, ~467 validations).
- Re-run with `npm run db:reset` + `npm run db:setup` in `../admin` for a clean state.

## Notes

- The mobile app must **never** connect to the database directly — always via the public API.
- Card UIDs are `TEXT`/`BIGINT`; handle them as strings everywhere (JSON cannot serialize `BigInt`).