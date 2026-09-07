import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";
import { startOfDay } from "@/app/tenant-admin/_lib/valet-api";

export async function GET(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  try {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const { rows } = await query(
      `SELECT d.id, d.valet_id, d.full_name, d.initials, d.avatar_color,
              d.email, d.phone, d.status, d.shift_started_at, d.property_id,
              p.name AS property_name,
              (SELECT COUNT(*)::int FROM orders o
                 WHERE o.driver_id = d.id AND o.created_at >= $1 AND o.created_at < $2) AS today_orders,
              (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (o.returned_at - o.dropped_at)) / 60))::int FROM orders o
                 WHERE o.driver_id = d.id AND o.returned_at >= $1 AND o.returned_at < $2
                   AND o.dropped_at IS NOT NULL) AS avg_min
       FROM drivers d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE d.id = $3`,
      [today, tomorrow, claims.driverId]
    );
    const driver = rows[0] as
      | {
          id: number;
          valet_id: string;
          full_name: string;
          initials: string;
          avatar_color: string;
          email: string | null;
          phone: string | null;
          status: string;
          shift_started_at: Date | null;
          property_id: number | null;
          property_name: string | null;
          today_orders: number;
          avg_min: number | null;
        }
      | undefined;
    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    return NextResponse.json({
      driver: {
        id: driver.id,
        valetId: driver.valet_id,
        fullName: driver.full_name,
        initials: driver.initials,
        avatarColor: driver.avatar_color,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        shiftStartedAt: driver.shift_started_at,
        propertyId: driver.property_id,
        propertyName: driver.property_name,
        todayOrders: driver.today_orders,
        avgReturnMin: driver.avg_min || 0,
      },
    });
  } catch (err) {
    console.error("[driver-profile]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}