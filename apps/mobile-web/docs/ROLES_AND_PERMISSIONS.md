# ROLES_AND_PERMISSIONS.md

## Current State

The mobile web app has **no account system** — it is a public guest-facing page. Access is controlled entirely by what the guest does and by server-side checks on the **admin console's** public API.

| Actor | What they can do | How it's gated |
|---|---|---|
| **Guest** | Look up a card (`GET /public/tap/[uid]`), request their car back (`POST /public/tap/[uid]`), browse offers, view live status | The card UID in the URL — nothing else |
| **Staff** | Validate a valet offer for a guest (enters the 4-digit staff code in the app's offer detail view) | The offer's `staff_code`, checked server-side by `POST /api/public/offer/validate`; the code is never exposed |

## How authorization works

- There is **no session, cookie, or login** anywhere in this app (see `AGENTS.md` — the app is public by design).
- The card UID is an **identifier**, not a credential — it never grants admin access.
- The only gated action (offer validation) is enforced **server-side** on the admin console against `offers.staff_code`. The mobile app only ever receives a boolean result.

## Screen access

All views require nothing more than a resolved card lookup:

| View | Data route | Access |
|---|---|---|
| Landing | none (local) | anyone |
| Home | `GET /api/public/tap/[uid]` | guest with a valid UID |
| Live status | `POST /api/public/tap/[uid]` + WebSocket | guest with a valid UID + parked order |
| Offers listing / detail | from the tap response | guest with a valid UID |
| Staff validation | `POST /api/public/offer/validate` | anyone holding the correct staff code |

## Planned

- Push notifications (replaces the open-tab countdown).
- Guest "remember me" history per card (needs an on-device storage strategy).
- If the business adds member tiers or promo codes tied to a phone number, that logic should live on the **admin console** — this app stays a thin public client.