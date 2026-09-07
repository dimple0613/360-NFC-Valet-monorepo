import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";

export async function POST(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;

  let body: { pushToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { pushToken } = body || {};
  if (!pushToken || typeof pushToken !== "string") {
    return NextResponse.json({ error: "pushToken is required" }, { status: 400 });
  }

  try {
    await query("UPDATE drivers SET push_token = $1 WHERE id = $2", [pushToken, auth.claims.driverId]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver-push-token]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}