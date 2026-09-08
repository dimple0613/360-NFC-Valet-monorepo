# DATABASE.md - Database Reference

## Overview

The mobile web app has **no database of its own**. It reads and writes the **super admin console's** PostgreSQL database (a single platform DB behind `DATABASE_URL`) through the admin's public API endpoints. The schema, migrations, and services live in `packages/db` (`prisma/schema.prisma`, `prisma/migrations`, `src/**`).

- **PostgreSQL 18** (Laragon) on `localhost:5432`, database per `DATABASE_URL` (e.g. `valet_monorepo`).
- Connection string from `DATABASE_URL` (`packages/db/.env`, loaded by `web/next.config.ts`).

## Tables the public tap endpoints read/write

### `nfc_cards`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `uid` | text | unique identifier printed on the card — the mobile app's key; **immutable once created** |
| `physical_uid` | text nullable | alias column, unpopulated |
| `card_number` | text nullable | alias column, unpopulated |
| `property_id` | int FK → properties | **nullable** — `NULL` = unassigned (deck inventory) |
| `status` | text | `unassigned` (deck, no property) / `assigned` (property picked, not printed) / `printed` (print run finished — UID + property frozen) / `defect` (retired after print) / legacy `ready` / `with_guest` / `returned` / `blocked` / `lost` |
| `uses_count` | int | lifetime activations |
| `lost_at` | timestamptz nullable | when marked lost |
| `printed_at` | timestamptz nullable | when the print/export run completed |
| `printed_by` | text nullable | user id that recorded the print |
| `prints_count` | int | number of export runs recorded against the card |

### `card_deck`

Platform-wide inventory single series (prefix + next number) that mints new NFC cards. One row (`id = 1`), advanced atomically under a row lock so concurrent batches never overlap UIDs. Migrated from the legacy per-location `card_pool`/`uid_start` auto-generation (locations no longer mint cards on create).

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | fixed `1` |
| `prefix` | text | series prefix, e.g. `NFC` |
| `next_uid` | bigint | next card number handed out |
| `updated_at` | timestamptz | |

### `nfc_print_profiles`

Per-organization print artwork used by the card print designer: a front + back template image, with QR code and UID placed by the export flow.

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `organization_id` | text nullable FK → organizations | org scope of the profile |
| `name` | text | profile name |
| `front_image_url` | text nullable | front template image |
| `back_image_url` | text nullable | back template image |
| `created_at` | timestamptz | |

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
| `validates_valet` | boolean | enables the location-level staff validation box on home / status while waiting |
| `staff_code` | text nullable | property-level secret validation code — never returned by any endpoint |

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
- **Validate staff code** — compare the posted `code` with `offers.staff_code` (offer-level) or `properties.staff_code` (location-level). A successful validation records a row in `validations` (`offer_id` XOR `property_id`) when the card has a live order.

## Seeding

- Admin console's `db/seed.js` is idempotent and seeds 3 properties, 22 drivers, 22 offers, and 7 days of orders + validations (~1,550 orders, ~467 validations).
- Re-run with `npm run db:reset` + `npm run db:setup` in `../admin` for a clean state.

## Notes

- The mobile app must **never** connect to the database directly — always via the public API.
- Card UIDs are `TEXT`/`BIGINT`; handle them as strings everywhere (JSON cannot serialize `BigInt`).