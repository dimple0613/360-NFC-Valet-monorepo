import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { rateLimit } from "@/lib/valet-rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(req, { max: 10, windowMs: 60000 })) {
    return NextResponse.json({ error: "Too many requests — try again in a minute" }, { status: 429 });
  }

  let body: { offerId?: number; code?: string; cardUid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const offerId = Number(body?.offerId);
  const code = String(body?.code || "").trim();
  const cardUid = String(body?.cardUid || "").trim();
  if (!offerId || !code) {
    return NextResponse.json({ error: "Offer and staff code are required" }, { status: 400 });
  }

  try {
    const { rows } = await query("SELECT id, staff_code FROM offers WHERE id = $1 AND live = true AND draft = false", [
      offerId,
    ]);
    const offer = rows[0] as { id: number; staff_code: string | null } | undefined;
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    if (!offer.staff_code) {
      return NextResponse.json({ error: "This offer has no validation code" }, { status: 400 });
    }
    if (String(offer.staff_code) !== code) {
      return NextResponse.json({ ok: false, validated: false, error: "Incorrect staff code" }, { status: 403 });
    }

    let orderId: number | null = null;
    if (cardUid) {
      const { rows: cards } = await query("SELECT id FROM nfc_cards WHERE uid = $1", [cardUid]);
      if (cards.length) {
        const { rows: orderRows } = await query(
          "SELECT id FROM orders WHERE card_id = $1 AND status IN ('active','parked','returning') ORDER BY created_at DESC LIMIT 1",
          [cards[0].id]
        );
        orderId = orderRows[0]?.id || null;
      }
    }

    if (orderId) {
      const { rows: existing } = await query(
        "SELECT id FROM validations WHERE order_id = $1 AND offer_id = $2",
        [orderId, offerId]
      );
      if (!existing.length) {
        await query("INSERT INTO validations (order_id, offer_id, qty, amount) VALUES ($1, $2, 1, 0)", [
          orderId,
          offerId,
        ]);
      }
    }

    return NextResponse.json({ ok: true, validated: true });
  } catch (err) {
    console.error("[public-offer-validate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}