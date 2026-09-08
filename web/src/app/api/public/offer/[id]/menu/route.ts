import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { rateLimit } from "@/lib/valet-rate-limit";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(req, { max: 40, windowMs: 60000 })) {
    return NextResponse.json({ error: "Too many requests — try again in a minute" }, { status: 429 });
  }

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Invalid offer id" }, { status: 400 });
  }

  const { rows } = await query(
    `SELECT id, menu_url FROM offers WHERE id = $1 AND live = true AND draft = false AND menu_url IS NOT NULL`,
    [id]
  );
  const offer = rows[0] as { id: number; menu_url: string } | undefined;
  if (!offer) return NextResponse.json({ error: "Offer menu not found" }, { status: 404 });

  const menuUrl = offer.menu_url;
  if (menuUrl.startsWith("data:")) {
    const comma = menuUrl.indexOf(",");
    if (comma < 0) return NextResponse.json({ error: "Invalid menu data" }, { status: 400 });
    const meta = menuUrl.slice(5, comma).split(";");
    if (!meta.includes("base64")) {
      return NextResponse.json({ error: "Menu must be base64 encoded" }, { status: 400 });
    }
    const mime = meta.find((p) => p.includes("/")) || "application/pdf";
    const buf = Buffer.from(menuUrl.slice(comma + 1), "base64");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": 'inline; filename="menu.pdf"',
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  if (/^https?:\/\//.test(menuUrl)) {
    return NextResponse.redirect(menuUrl, 302);
  }

  return NextResponse.json({ error: "Menu unavailable" }, { status: 400 });
}