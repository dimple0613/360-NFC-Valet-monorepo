import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";
import { startOfDay } from "@/app/tenant-admin/_lib/valet-api";

export async function GET(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  const today = startOfDay(new Date());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  try {
    const { rows: statsRows } = await query(
      `SELECT
        COUNT(*)::int AS parked_today,
        COUNT(*) FILTER (WHERE o.status = 'returning' OR o.status = 'retrieving')::int AS returns_pending,
        ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int AS avg_min
       FROM orders o
       WHERE o.driver_id = $1 AND o.created_at >= $2 AND o.created_at < $3`,
      [claims.driverId, today, tomorrow]
    );
    const stats = statsRows[0] || { parked_today: 0, returns_pending: 0, avg_min: 0 };

    let queue: Array<Record<string, unknown>> = [];
    if (claims.propertyId) {
      const { rows: queueRows } = await query(
        `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.zone, o.slot,
                o.status, o.guest_eta, o.created_at, c.uid AS card_uid
         FROM orders o
         LEFT JOIN nfc_cards c ON c.id = o.card_id
         WHERE o.property_id = $1
           AND o.status IN ('active','parked','returning','retrieving')
           AND o.created_at >= $2
         ORDER BY
           CASE o.status WHEN 'returning' THEN 0 WHEN 'retrieving' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
           o.guest_eta NULLS LAST, o.created_at
         LIMIT 20`,
        [claims.propertyId, today]
      );
      queue = queueRows.map((o) => ({
        id: o.id,
        plate: o.plate,
        car: [o.car_color, o.car_make, o.car_model].filter(Boolean).join(" "),
        zone: o.zone,
        slot: o.slot,
        status: o.status,
        guestEta: o.guest_eta,
        createdAt: o.created_at,
        cardUid: o.card_uid,
      }));
    }

    return NextResponse.json({
      stats: {
        parkedToday: stats.parked_today,
        returnsPending: stats.returns_pending,
        avgReturnMin: stats.avg_min || 0,
      },
      queue,
    });
  } catch (err) {
    console.error("[driver-dashboard]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}