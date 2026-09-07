import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { rateLimit } from "@/lib/valet-rate-limit";

export async function POST(req: Request) {
  if (!rateLimit(req, { max: 10, windowMs: 60000 })) {
    return NextResponse.json({ error: "Too many requests — try again in a minute" }, { status: 429 });
  }

  let body: { offerId?: number; propertyId?: number; code?: string; cardUid?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const offerId = body?.offerId ? Number(body.offerId) : null;
  const propertyId = body?.propertyId ? Number(body.propertyId) : null;
  const code = String(body?.code || "").trim();
  const cardUid = String(body?.cardUid || "").trim();
  if ((!offerId && !propertyId) || !code) {
    return NextResponse.json({ error: "Staff validation code is required" }, { status: 400 });
  }

  try {
    let stockCode: string | null = null;
    let targetOffer = offerId;
    let targetProperty = propertyId;

    if (offerId) {
      const { rows } = await query("SELECT id, staff_code FROM offers WHERE id = $1 AND live = true AND draft = false", [
        offerId,
      ]);
      const offer = rows[0] as { id: number; staff_code: string | null } | undefined;
      if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      if (!offer.staff_code) {
        return NextResponse.json({ error: "This offer has no validation code" }, { status: 400 });
      }
      stockCode = offer.staff_code;
      targetProperty = null;
    } else if (propertyId) {
      const { rows } = await query("SELECT staff_code, validates_valet FROM properties WHERE id = $1", [propertyId]);
      const prop = rows[0] as { staff_code: string | null; validates_valet: boolean | null } | undefined;
      if (!prop) return NextResponse.json({ error: "Property not found" }, { status: 404 });
      if (!prop.validates_valet) {
        return NextResponse.json({ error: "This location has no validation enabled" }, { status: 400 });
      }
      if (!prop.staff_code) {
        return NextResponse.json({ error: "This location has no validation code" }, { status: 400 });
      }
      stockCode = prop.staff_code;
      targetOffer = null;
    }

    if (String(stockCode) !== code) {
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
      if (targetOffer != null) {
        const { rows: dupes } = await query("SELECT id FROM validations WHERE order_id = $1 AND offer_id = $2", [
          orderId,
          targetOffer,
        ]);
        if (!dupes.length) {
          await query("INSERT INTO validations (order_id, offer_id, qty, amount) VALUES ($1, $2, 1, 0)", [
            orderId,
            targetOffer,
          ]);
        }
      } else if (targetProperty != null) {
        const { rows: dupes } = await query(
          "SELECT id FROM validations WHERE order_id = $1 AND property_id = $2 AND offer_id IS NULL",
          [orderId, targetProperty]
        );
        if (!dupes.length) {
          await query("INSERT INTO validations (order_id, property_id, qty, amount) VALUES ($1, $2, 1, 0)", [
            orderId,
            targetProperty,
          ]);
        }
      }
    }

    return NextResponse.json({ ok: true, validated: true });
  } catch (err) {
    console.error("[public-offer-validate]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}