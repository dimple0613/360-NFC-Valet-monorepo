import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";
import { broadcast } from "@/lib/valet-live";

export async function POST(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;

  let body: { orderId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const orderId = Number(body?.orderId);
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  try {
    const { rows } = await query(
      "SELECT id, property_id FROM orders WHERE id = $1 AND status = 'returning'",
      [orderId]
    );
    const order = rows[0] as { id: number; property_id: number } | undefined;
    if (!order) {
      return NextResponse.json({ error: "No active return request found" }, { status: 404 });
    }

    broadcast("valet.delay.notified", {
      propertyId: order.property_id,
      orderId,
      driverId: auth.claims.driverId,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver-notify-delay]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}