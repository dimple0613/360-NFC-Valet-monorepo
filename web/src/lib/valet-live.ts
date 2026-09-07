// Server-side writer for the valet real-time events. The Next app and the WS
// server are separate processes: Next calls POST /broadcast on the WS server
// (WS_BROADCAST_URL, default http://localhost:3002) and the socket server fans
// the event out to every room the event's property is subscribed to — property
// zones for the guest web and the driver app, plus the "admin" room for the
// tenant-admin console.
//
// Broadcast payloads are shaped by the socket contract (apps/mobile-web/docs/
// API_REFERENCE.md and docs/socket-events.md): server→client events always
// carry `{ propertyId, ... }` and clients key off `orderId`.

export async function broadcast(event: string, data: Record<string, unknown>): Promise<void> {
  const base = process.env.WS_BROADCAST_URL || "http://localhost:3002";
  try {
    await fetch(`${base.replace(/\/+$/, "")}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
      signal: AbortSignal.timeout(1500),
    });
  } catch (err) {
    console.error(`[valet-live] broadcast "${event}" failed:`, (err as Error)?.message);
  }
}