import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";

export async function GET(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  try {
    if (!claims.propertyId) {
      return NextResponse.json({ queue: [] });
    }
    const { rows } = await query(
      `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.zone, o.slot,
              o.status, o.guest_eta, o.created_at, o.dropped_at, o.returned_at,
              c.uid AS card_uid,
              d.id AS assigned_driver_id, d.full_name AS driver_name
       FROM orders o
       LEFT JOIN nfc_cards c ON c.id = o.card_id
       LEFT JOIN drivers d ON d.id = o.driver_id
       WHERE o.property_id = $1
         AND o.status IN ('active','parked','returning','retrieving')
       ORDER BY
         CASE o.status WHEN 'returning' THEN 0 WHEN 'retrieving' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
         o.guest_eta NULLS LAST, o.created_at
       LIMIT 50`,
      [claims.propertyId]
    );

    const queue = rows.map((o) => ({
      id: o.id,
      plate: o.plate,
      car: [o.car_color, o.car_make, o.car_model].filter(Boolean).join(" "),
      zone: o.zone,
      slot: o.slot,
      status: o.status,
      isMine: o.assigned_driver_id === claims.driverId,
      driverName: o.driver_name,
      guestEta: o.guest_eta,
      createdAt: o.created_at,
      droppedAt: o.dropped_at,
      returnedAt: o.returned_at,
      cardUid: o.card_uid,
    }));

    return NextResponse.json({ queue });
  } catch (err) {
    console.error("[driver-queue]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}