# Socket Events

Real-time contract between the 360 NFC Valet clients (guest web, driver app, tenant-admin console) and the standalone socket server on `WS_PORT` (default **3002**). The server is `web/ws-server.ts` (run with `pnpm --filter web vws`); the Next app publishes through it via `web/src/lib/valet-live.ts` (POST `/broadcast` on `WS_BROADCAST_URL`).

> **Successor to the legacy `360-NFC-Valet/admin/ws-server.js`**: the old server was a thin relay — it received `{ event, data }` over HTTP `POST /broadcast` and re-emitted to the `property:<id>` + `admin` rooms, exact same contract as today. The event names/payloads below are the live source of truth, captured from the current monorepo broadcast call sites (`web/src/app/api/driver/**`, `web/src/app/api/public/**`). The new server keeps the legacy event names verbatim so both apps require zero client changes.

## Connection

| Client | Endpoint | Auth |
| --- | --- | --- |
| Guest web         | `http://localhost:3002` (socket.io, `transports: ["websocket","polling"]`) | anonymous |
| Driver app        | same endpoint (socket.io) | `auth: { token, role: "driver" }` on connect — HS256 driver JWT |
| Tenant-admin console | raw browser `WebSocket` → `ws://localhost:3002/live/admin?token=<valet_ws_token>` | ws-token in query string (`<sessionId>.<expiryMs>.<hmacHex>`) |

Guests and drivers join property rooms with the control message:

```js
socket.emit("subscribe:property", propertyId); // number, e.g. 1
socket.emit("unsubscribe:property", propertyId);
```

Drivers are additionally auto-joined to their shift `property:<id>` from the JWT claim. The console `/live/admin` socket auto-joins the `admin` room. No driver JWT / session is required for the guest socket — it is public by design.

## Rooms / fan-out

Every server→client event carries `{ propertyId, ... }`. Events are fanned out to **both** `property:<propertyId>` and the socket.io `admin` room, so:

- the guest web watching card `7001` (subscribed to its property) gets the live status update,
- the driver app on a shift at that property gets it,
- any socket.io client in the `admin` room (join via token on `/live/`) gets every broadcast — resource-level filtering is a later concern (see `web/ws-server.ts`).
- the tenant-admin console's **raw** WebSocket at `/live/admin` (see `web/src/lib/ws.ts`) is a SEPARATE, non-socket.io path: it does NOT receive fan-out payloads today — it is used only as a connectivity heartbeat (queue/offers still fall back to polling).

## Server → client events

| Event | Emitted when | Payload (beyond `propertyId`, `timestamp`) |
| --- | --- | --- |
| `valet.order.created` | driver creates an order (car dropped) | `orderId`, `cardUid?`, `driverId`, `plate`, `status: "active"` |
| `valet.order.parked` | driver marks an order parked (`status: "parked"`, zone/slot assigned) | `orderId`, `driverId`, `status`, `zone?`, `slot?` |
| `valet.order.return.requested` | **guest taps "car on the way"** (public tap POST) **or** driver marks `returning` with ETA | via guest: `orderId`, `minutes?`, `guestEta?`, `status: "returning"` — via driver: same `orderId`/`status` plus `driverId`, `zone?`, `slot?` |
| `valet.order.retrieving` | driver marks an order retrieving (`status: "retrieving"`) | `orderId`, `driverId`, `status` |
| `valet.order.completed` | order returned (card back to `ready`) | `orderId`, `driverId`, `status: "returned"` |
| `valet.delay.notified` | driver notifies guest of a delay (`notify-delay`) | `orderId`, `driverId` |
| `valet.order.updated` | generic fallback for any other transition | `orderId`, `status?` |
| `driver.shift.started` / `driver.shift.ended` | driver starts/ends a shift | `driverId`, `driverName`, `valetId`, `status?` |
| `nfc.card.activated` | card used to create an order | `orderId`, `driverId`, `plate`, `cardUid?`, `carMake?`, `carModel?`, `carColor?` |

## Client → server control messages

- `subscribe:property` / `unsubscribe:property` — property room membership (guest + driver).
- Driver sockets send `auth: { token, role: "driver" }` on connect; the server validates the HS256 JWT with `JWT_SECRET` and joins the driver to its shift property. Rejects with `Invalid or expired token` otherwise.
- The raw admin socket sends `{ type: "ping" }` → server replies `{ type: "pong" }` (keep-alive only). Admin sockets otherwise do not consume event payloads today (queue UI still uses 20s polling).

## Broadcast shapes

Broadcasts go through `web/src/app/api/**` calling `broadcast(event, data)` from `web/src/lib/valet-live.ts`. That POSTs to `/broadcast` on the socket server, which emits to the matching `property:<id>` room plus the `admin` room. Clients key off `orderId` to update their local queue/banners.

## Env

- `WS_PORT` (default 3002), `WS_ORIGIN` (comma list; `*` = any), `JWT_SECRET` → socket handshake signing, `WS_BROADCAST_URL` (Next→socket, default `http://localhost:3002`).