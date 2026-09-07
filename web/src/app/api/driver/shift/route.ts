import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";
import { signDriverToken } from "@/lib/driver-jwt";
import { broadcast } from "@/lib/valet-live";

export async function PATCH(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  let body: { onShift?: boolean; propertyId?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { onShift } = body || {};
  const propertyId = body?.propertyId ? Number(body.propertyId) : null;
  if (typeof onShift !== "boolean") {
    return NextResponse.json({ error: "onShift boolean is required" }, { status: 400 });
  }

  try {
    if (onShift) {
      if (propertyId) {
        await query(
          "UPDATE drivers SET status = 'on_shift', shift_started_at = NOW(), property_id = $1 WHERE id = $2",
          [propertyId, claims.driverId]
        );
      } else {
        await query(
          "UPDATE drivers SET status = 'on_shift', shift_started_at = NOW() WHERE id = $1",
          [claims.driverId]
        );
      }
    } else {
      const { rows: activeOrders } = await query(
        "SELECT COUNT(*)::int AS cnt FROM orders WHERE driver_id = $1 AND status IN ('active','parked','returning','retrieving')",
        [claims.driverId]
      );
      if ((activeOrders[0]?.cnt || 0) > 0) {
        return NextResponse.json(
          { error: `Cannot end shift — ${activeOrders[0].cnt} order(s) still active. Complete or transfer them first.` },
          { status: 400 }
        );
      }
      await query("UPDATE drivers SET status = 'off_duty', shift_started_at = NULL WHERE id = $1", [
        claims.driverId,
      ]);
    }

    const { rows } = await query("SELECT status, shift_started_at FROM drivers WHERE id = $1", [
      claims.driverId,
    ]);
    const status = rows[0]?.status as string | undefined;
    const shiftStartedAt = rows[0]?.shift_started_at as Date | null | undefined;

    let token: string | null = null;
    if (onShift && propertyId) {
      token = signDriverToken({
        driverId: claims.driverId,
        valetId: claims.valetId,
        propertyId,
        ttlSec: 60 * 60 * 8,
      });
    }

    const { rows: driverRows } = await query("SELECT full_name FROM drivers WHERE id = $1", [
      claims.driverId,
    ]);

    broadcast(onShift ? "driver.shift.started" : "driver.shift.ended", {
      propertyId: onShift ? propertyId || claims.propertyId : claims.propertyId,
      driverId: claims.driverId,
      driverName: driverRows[0]?.full_name || "",
      valetId: claims.valetId,
      status: status || null,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      status: status ?? "off_duty",
      shiftStartedAt: shiftStartedAt ?? null,
      ...(token ? { token } : {}),
    });
  } catch (err) {
    console.error("[driver-shift]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}