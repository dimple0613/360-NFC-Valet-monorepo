import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { verifyPassword } from "@/app/tenant-admin/_lib/valet-auth";
import { signDriverToken } from "@/lib/driver-jwt";

export async function POST(req: Request) {
  let body: { valetId?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { valetId, password } = body || {};
  if (!valetId || !password) {
    return NextResponse.json({ error: "Driver ID and password are required" }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `SELECT d.id, d.valet_id, d.full_name, d.initials, d.avatar_color, d.email, d.phone,
              d.status, d.property_id, p.name AS property_name, d.password_hash, d.token_version
       FROM drivers d
       LEFT JOIN properties p ON p.id = d.property_id
       WHERE LOWER(d.valet_id) = LOWER($1)
       LIMIT 1`,
      [String(valetId).trim()]
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
          property_id: number | null;
          property_name: string | null;
          password_hash: string | null;
        }
      | undefined;
    if (!driver || !verifyPassword(String(password), driver.password_hash)) {
      return NextResponse.json({ error: "Invalid Driver ID or password" }, { status: 401 });
    }

    const token = signDriverToken({
      driverId: driver.id,
      valetId: driver.valet_id,
      propertyId: driver.property_id,
      ttlSec: 60 * 60 * 8,
    });

    return NextResponse.json({
      token,
      driver: {
        id: driver.id,
        valetId: driver.valet_id,
        fullName: driver.full_name,
        initials: driver.initials,
        avatarColor: driver.avatar_color,
        email: driver.email,
        phone: driver.phone,
        status: driver.status,
        propertyId: driver.property_id,
        propertyName: driver.property_name,
      },
    });
  } catch (err) {
    console.error("[driver-login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}