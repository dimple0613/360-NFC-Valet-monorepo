# API Reference — platform valet surface

The admin console (`web/`) exposes the NFC card deck and print workflow under
`/api/platform/valet/*`. All endpoints require an authenticated `web/` session.
Permission gates:

- `valet.card.read`   (tenant) — list/view cards
- `valet.card.manage` (tenant) — assign/unassign + operational status ops
- `valet.card.create` (platform, Super Admin) — mint cards into the deck
- `valet.card.print`  (platform, Super Admin) — print profiles, mark printed/defect

A platform caller (`valet.card.create` or `valet.card.print`) may pass an
`organizationId` (query/body) to scope operations to the org currently viewed
on `/super-admin/organizations/[id]`. Tenant callers are always scoped to their
session organization.

## `GET /api/platform/valet/cards`

List cards for the deck (plus org-scoped cards when run from the tenant portal
or an SA org tab). Gate: platform op OR `valet.card.read`.

Query params: `q`, `page`, `pageSize`, `sortBy`, `sortDir`, `status`
(`unassigned|assigned|printed|defect|ready|with_guest|returned|blocked`),
`property` (`unassigned` or a property id), `organizationId` (platform only).

Response:

```json
{
  "items": [{ "id": 1, "uid": "NFC-07406", "status": "unassigned", "property": null, ... }],
  "properties": [{ "id": 3, "name": "City Tower" }],
  "totalCount": 12,
  "page": 1,
  "pageSize": 15,
  "deck": { "prefix": "NFC", "nextUid": "07418", "total": 13, "unassigned": 12, "assigned": 1, "printed": 0, "defect": 0, "active": 0 }
}
```

`deck` is the platform deck summary (series prefix, next UID, status counts);
it is `null` if the deck is not initialized.

## `POST /api/platform/valet/cards`

Mint cards into the platform deck. Gate: platform `valet.card.create` only
(Super Admin). Body: `{ prefix, from, to, propertyId?, organizationId? }` where
`prefix` is exactly 3 letters and `from`/`to` a range (max 500). Created cards
are `unassigned` unless `propertyId` binds them (then `assigned`).

Response `201`: `{ "created": 50, "from": "NFC-07406", "to": "NFC-07455" }`.

The `prefix`+range form is the batch register flow; the internal `card_deck`
series (`createDeckCards`) is reserved for platform programmatic minting.

## `PATCH /api/platform/valet/cards`

Update a card. Gate: platform op OR `valet.card.manage`. Body:
`{ id | uid, action, propertyId?, remove?, organizationId? }`.

Actions:

| action | gate | effect |
|---|---|---|
| `assign` | tenant manage / platform | bind `uid` to `propertyId` (frozen cards rejected) |
| `unassign` | tenant manage / platform | return `uid` to the deck, status → `unassigned` (frozen cards rejected) |
| `printed` | platform `valet.card.print` | mark printed — freezes UID + property, records `printed_at`, `printed_by`, `prints_count` |
| `defect` | platform `valet.card.print` | retire the card (no print, no reassign) |
| `block` / `unblock` / `mark-returned` / `lost` | tenant manage / platform | operational status ops |
| `remove` (body `remove: true`, `id` required) | tenant manage / platform | delete a card row |

UID is immutable: there is no edit/rename path anywhere.

## `GET|POST|PATCH|DELETE /api/platform/valet/print-profiles`

Manage the Super Admin (platform) print artwork used by the batch print
designer. Gate: platform `valet.card.print` on every verb.

- `GET` → `{ "profiles": [{ "id", "name", "frontImageUrl", "backImageUrl", "createdAt" }] }`
- `POST` body `{ name, frontImageUrl?, backImageUrl? }` → `201 { "id": n }`
- `PATCH` body `{ id, name?, frontImageUrl?, backImageUrl? }` → `{ "updated": true }`
- `DELETE?id=n` → `{ "removed": true }`

Errors are JSON `{ "error": "..." }` with 400/403/404/500 as appropriate.