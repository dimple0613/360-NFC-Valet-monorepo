import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";
import { broadcast } from "@/lib/valet-live";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  const { id } = await params;
  const orderId = Number(id);
  if (!orderId) return NextResponse.json({ error: "Order ID is required" }, { status: 400 });

  let body: { status?: string; zone?: string; slot?: string; guestEta?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const { rows: orderRows } = await query("SELECT id, driver_id, status FROM orders WHERE id = $1", [orderId]);
    const order = orderRows[0] as { id: number; driver_id: number | null; status: string } | undefined;
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const { status, zone, slot } = body || {};
    const guestEtaMinutes = Number(body?.guestEta) || null;

    if (status === "parked") {
      if (order.driver_id !== claims.driverId && order.driver_id !== null) {
        return NextResponse.json({ error: "Not your order" }, { status: 403 });
      }
      await query(
        `UPDATE orders SET status = 'parked', driver_id = $1, zone = COALESCE($2, zone), slot = COALESCE($3, slot), dropped_at = NOW()
         WHERE id = $4`,
        [claims.driverId, zone || null, slot || null, orderId]
      );
    } else if (status === "retrieving") {
      if (order.driver_id !== claims.driverId) {
        await query("UPDATE orders SET driver_id = $1 WHERE id = $2", [claims.driverId, orderId]);
      }
      await query("UPDATE orders SET status = 'retrieving' WHERE id = $1", [orderId]);
    } else if (status === "returning") {
      if (order.driver_id !== claims.driverId) {
        await query("UPDATE orders SET driver_id = $1 WHERE id = $2", [claims.driverId, orderId]);
      }
      if (guestEtaMinutes) {
        await query(
          `UPDATE orders SET status = 'returning', guest_eta = NOW() + ($1 || ' minutes')::interval WHERE id = $2`,
          [String(guestEtaMinutes), orderId]
        );
      } else {
        await query("UPDATE orders SET status = 'returning' WHERE id = $1", [orderId]);
      }
    } else if (status === "returned") {
      if (order.driver_id !== claims.driverId) {
        await query("UPDATE orders SET driver_id = $1 WHERE id = $2", [claims.driverId, orderId]);
      }
      await query("UPDATE orders SET status = 'returned', returned_at = NOW() WHERE id = $1", [orderId]);
      const { rows: cardRows } = await query("SELECT card_id FROM orders WHERE id = $1", [orderId]);
      if (cardRows[0]?.card_id) {
        await query("UPDATE nfc_cards SET status = 'ready' WHERE id = $1", [cardRows[0].card_id]);
      }
    } else {
      return NextResponse.json(
        { error: "Invalid status. Use: parked, returning, retrieving, or returned" },
        { status: 400 }
      );
    }

    const { rows: orderInfo } = await query("SELECT property_id FROM orders WHERE id = $1", [orderId]);
    const propId = orderInfo[0]?.property_id as number | undefined;

    const eventMap: Record<string, string> = {
      parked: "valet.order.parked",
      returning: "valet.order.return.requested",
      retrieving: "valet.order.retrieving",
      returned: "valet.order.completed",
    };

    broadcast(eventMap[status as string] || "valet.order.updated", {
      propertyId: propId,
      orderId,
      driverId: claims.driverId,
      status,
      zone: zone || null,
      slot: slot || null,
      guestEta: status === "returning" ? guestEtaMinutes : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver-orders PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}