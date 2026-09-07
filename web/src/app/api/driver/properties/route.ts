import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";

export async function GET(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  try {
    const { rows } = await query(
      `SELECT p.id, p.name, p.area, p.city, p.slug,
              (SELECT COUNT(*)::int FROM drivers d2 WHERE d2.property_id = p.id AND d2.status = 'on_shift') AS drivers_on_shift
       FROM properties p
       WHERE p.organization_id = (SELECT d.organization_id FROM drivers d WHERE d.id = $1)
          OR (SELECT d.organization_id FROM drivers d WHERE d.id = $1) IS NULL
       ORDER BY p.name`,
      [claims.driverId]
    );

    const properties = rows.map((r) => ({
      id: r.id,
      name: r.name,
      area: r.area,
      city: r.city,
      slug: r.slug,
      driversOnShift: r.drivers_on_shift,
    }));

    return NextResponse.json({ properties });
  } catch (err) {
    console.error("[driver-properties]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}