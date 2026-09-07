import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";

export async function GET(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  try {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "day";
    let interval = "1 day";
    if (period === "week") interval = "7 days";
    else if (period === "month") interval = "30 days";

    const { rows: statsRows } = await query(
      `SELECT
        COUNT(*)::int AS total,
        ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int AS avg_min
       FROM orders o
       WHERE o.driver_id = $1
         AND o.status = 'returned'
         AND o.returned_at >= NOW() - $2::interval`,
      [claims.driverId, interval]
    );
    const stats = statsRows[0] || { total: 0, avg_min: 0 };

    const { rows } = await query(
      `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.zone, o.slot,
              o.status, o.created_at, o.dropped_at, o.returned_at,
              c.uid AS card_uid
       FROM orders o
       LEFT JOIN nfc_cards c ON c.id = o.card_id
       WHERE o.driver_id = $1
         AND o.status = 'returned'
         AND o.returned_at >= NOW() - $2::interval
       ORDER BY o.returned_at DESC
       LIMIT 100`,
      [claims.driverId, interval]
    );

    const history = rows.map((o) => {
      const duration =
        o.dropped_at && o.returned_at
          ? Math.round((new Date(o.returned_at).getTime() - new Date(o.dropped_at).getTime()) / 1000)
          : null;
      return {
        id: o.id,
        plate: o.plate,
        car: [o.car_color, o.car_make, o.car_model].filter(Boolean).join(" "),
        zone: o.zone,
        slot: o.slot,
        cardUid: o.card_uid,
        createdAt: o.created_at,
        droppedAt: o.dropped_at,
        returnedAt: o.returned_at,
        durationSeconds: duration,
      };
    });

    return NextResponse.json({
      stats: { total: stats.total, avgReturnMin: stats.avg_min || 0 },
      history,
    });
  } catch (err) {
    console.error("[driver-history]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}