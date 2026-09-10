import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { sendMail, buildResetEmail } from "@/lib/valet-mail";

const RESET_BASE_URL = process.env.RESET_URL || "http://localhost:3001";

export async function POST(req: Request) {
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { email } = body || {};
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const { rows } = await query("SELECT id, full_name FROM drivers WHERE LOWER(email) = LOWER($1) LIMIT 1", [
      String(email).trim(),
    ]);
    const driver = rows[0] as { id: number; full_name: string } | undefined;
    if (driver) {
      const token = randomBytes(32).toString("hex");
      const hash = createHash("sha256").update(token).digest("hex");
      await query(
        "INSERT INTO driver_reset_tokens (driver_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 hour')",
        [driver.id, hash]
      );

      const resetUrl = `${RESET_BASE_URL}/reset-password?token=${token}`;
      try {
        const result = await sendMail({
          to: String(email).trim(),
          subject: "Reset your password \u2014 360 NFC Valet",
          html: buildResetEmail({ driverName: driver.full_name, resetUrl }),
        });
        if (!result.sent) {
          return NextResponse.json({ ok: true, resetToken: token });
        }
      } catch (err) {
        console.error("[driver-forgot-password] SMTP send failed", err);
        return NextResponse.json({ ok: true, resetToken: token });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[driver-forgot-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}