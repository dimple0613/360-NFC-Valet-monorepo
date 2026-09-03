# API_REFERENCE.md

The mobile web has **no API routes of its own**. It consumes the **admin console's** public endpoints via `lib/client.js` (`api()`), which targets `NEXT_PUBLIC_ADMIN_API` (default `http://localhost:3000/api`). All endpoints below are CORS-enabled for this app's origin (see `middleware.js` in `../admin`, `CORS_ORIGINS`, default `http://localhost:3001`) and are **not** protected by `withSession`.

`api()` throws `Error` with a `status` property on non-2xx responses.

## Public tap endpoints (used by this app)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/public/tap/[uid]` | none | Resolve an NFC card UID (text) → `{ card, property, order, offers }`. `order` is the card's latest `active`/`parked`/`retrieving`/`returning` order (or `null`), with the assigned valet. `offers` = live, non-draft offers for the card's property, featured first. Unknown UID → `404 { error: "Card not found" }` |
| POST | `/api/public/tap/[uid]` | none | Bring-my-car. Body `{ minutes }` (5–60, int) → `{ ok, orderId, minutes, eta }`. Sets the card's latest order to `status='returning'` and `guest_eta = now() + minutes`. No parked order → `400 { error: "No parked car found for this card" }`. Out-of-range ETA → `400 { error: "ETA must be between 5 and 60 minutes" }` |
| POST | `/api/public/offer/validate` | none | Validate a staff-only offer code. Body `{ offerId, code, cardUid? }` → `200 { ok: true, validated: true }` on match, `403 { ok: false, validated: false, error: "Incorrect staff code" }` otherwise. `code` is compared against the offer's `staff_code`; the code itself is never returned by any endpoint |

## Response shapes

```jsonc
// GET /api/public/tap/72100112791
{
  "card": { "uid": "72100112791", "status": "ready", "usesCount": 0 },
  "property": {
    "id": 1, "name": "JW Marriott Marquis", "area": "Business Bay",
    "slug": "jw-marriott-marquis", "city": "Dubai", "phone": "+971 4 414 0000"
  },
  "order": {
    "plate": "DXB F 44556", "carMake": "Mercedes", "carModel": "S-Class", "carColor": "White",
    "zone": "A", "slot": 41, "status": "retrieving", "guestEta": null,
    "driver": { "name": "Suresh Rao", "initials": "SR", "color": "#0C9D61" }
  },
  "offers": [{
    "id": 1, "title": "Friday Brunch at Kitchen6", "category": "Dining", "price": 395,
    "wasPrice": 565, "desc": "...", "featured": 1, "validatesValet": true,
    "rating": 4.7, "reviews": 1240, "level": "Level 1",
    "opensAt": "12:30:00", "closesAt": "16:00:00", "dealTag": "FRIDAY ONLY"
  }]
}
```

```jsonc
// POST /api/public/tap/72100112791   body: { "minutes": 10 }
{ "ok": true, "orderId": 1043, "minutes": 10, "eta": "2026-08-20T14:32:00.000Z" }
```

## Usage

```js
import { api } from "@/lib/client";

const data = await api(`/public/tap/${uid}`);
const res = await api(`/public/tap/${uid}`, { method: "POST", body: { minutes } });
const val = await api("/public/offer/validate", {
  method: "POST",
  body: { offerId, code, cardUid },
});
```

## Real-time events (WebSocket, port 3002 — socket.io)

| Event | Payload | Effect in UI |
|---|---|---|
| `subscribe:property` | `{ propertyId }` (client→server) | subscribes the socket to a property |
| `valet.order.parked` | `{ orderId, propertyId }` | banner "Your car has been parked" + refetch |
| `valet.order.return.requested` | `{ orderId, propertyId }` | banner "Your car request has been received" + refetch |
| `valet.order.completed` | `{ orderId, propertyId }` | banner "Your car has arrived!" + refetch |
| `valet.delay.notified` | `{ orderId, propertyId }` | banner "Driver notified of a delay" + refetch |

Events matching the current order id re-run the tap fetch (via `fetchKey`) so the UI reflects server state.

## Notes

- Card UIDs are **text** and can exceed `INT4` (e.g. `72100112791`) — always handle them as strings.
- The mobile app must never call the session-protected admin routes; they return `401 { error: "Not signed in" }`.