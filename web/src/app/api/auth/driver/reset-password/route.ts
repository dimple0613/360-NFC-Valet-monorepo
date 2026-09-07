import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { hashPassword } from "@/app/tenant-admin/_lib/valet-auth";

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { token, password } = body || {};
  if (!token || !password) {
    return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  try {
    const tokenHash = createHash("sha256").update(String(token)).digest("hex");
    const { rows } = await query(
      `SELECT r.driver_id
       FROM driver_reset_tokens r
       WHERE r.token_hash = $1 AND r.used = false AND r.expires_at > now()
       ORDER BY r.id DESC LIMIT 1`,
      [tokenHash]
    );
    const reset = rows[0] as { driver_id: number } | undefined;
    if (!reset) {
      return NextResponse.json({ error: "Reset link is invalid or has expired" }, { status: 400 });
    }

    await query("UPDATE drivers SET password_hash = $2 WHERE id = $1", [
      reset.driver_id,
      hashPassword(String(password)),
    ]);
    await query("UPDATE driver_reset_tokens SET used = true WHERE token_hash = $1", [tokenHash]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver-reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}