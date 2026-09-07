import { NextResponse } from "next/server";
import { query } from "@/app/tenant-admin/_lib/db";
import { rateLimit } from "@/lib/valet-rate-limit";
import { broadcast } from "@/lib/valet-live";

function fmtTime(value: Date | null): string | null {
  if (!value) return null;
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  if (!rateLimit(req, { max: 30, windowMs: 60000 })) {
    return NextResponse.json({ error: "Too many requests — try again in a minute" }, { status: 429 });
  }

  const { uid: rawUid } = await params;
  const uid = String(rawUid || "").trim();
  if (!uid) return NextResponse.json({ error: "Card UID is required" }, { status: 400 });

  try {
    const { rows: cards } = await query(
      `SELECT c.id AS card_id, c.uid, c.status AS card_status, c.uses_count,
              p.id AS property_id, p.name AS property_name, p.area, p.slug, p.city, p.phone, p.validates_valet, p.staff_code
       FROM nfc_cards c
       JOIN properties p ON p.id = c.property_id
       WHERE c.uid = $1 OR UPPER(c.physical_uid) = UPPER($2)`,
      [uid, uid]
    );
    const card = cards[0] as
      | {
          card_id: number;
          uid: string;
          card_status: string;
          uses_count: number;
property_id: number;
      property_name: string;
      area: string;
      slug: string;
      city: string;
      phone: string | null;
      validates_valet: boolean | null;
      staff_code: string | null;
    }
      | undefined;
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    const { rows: offers } = await query(
      `SELECT id, title, category, price, was_price, description, featured, validates_valet,
              rating, reviews, level, opens_at, closes_at, deal_tag, image_url, menu_url, staff_code
       FROM offers
       WHERE property_id = $1 AND live = true AND draft = false
       ORDER BY (featured IS NULL), featured, id`,
      [card.property_id]
    );

    const { rows: orderRows } = await query(
      `SELECT o.id, o.plate, o.car_make, o.car_model, o.car_color, o.zone, o.slot, o.status, o.guest_eta,
              d.full_name AS driver_name, d.initials AS driver_initials, d.avatar_color AS driver_color
       FROM orders o
       LEFT JOIN drivers d ON d.id = o.driver_id
       WHERE o.card_id = $1 AND o.status IN ('active','parked','retrieving','returning','returned')
       ORDER BY o.created_at DESC LIMIT 1`,
      [card.card_id]
    );
    const order = orderRows[0] as
      | {
          id: number;
          plate: string;
          car_make: string | null;
          car_model: string | null;
          car_color: string | null;
          zone: string | null;
          slot: string | null;
          status: string;
          guest_eta: Date | null;
          driver_name: string | null;
          driver_initials: string | null;
          driver_color: string | null;
        }
      | undefined;

    return NextResponse.json({
      card: { uid: card.uid, status: card.card_status, usesCount: card.uses_count },
      property: {
        id: card.property_id,
        name: card.property_name,
        area: card.area,
        slug: card.slug,
        city: card.city,
        phone: card.phone,
        validatesValet: card.validates_valet,
        hasCode: Boolean(card.staff_code),
      },
      order: order
        ? {
            id: order.id,
            plate: order.plate,
            carMake: order.car_make,
            carModel: order.car_model,
            carColor: order.car_color,
            zone: order.zone,
            slot: order.slot,
            status: order.status,
            guestEta: order.guest_eta,
            driver: order.driver_name
              ? { name: order.driver_name, initials: order.driver_initials, color: order.driver_color }
              : null,
          }
        : null,
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        category: o.category,
        price: Number(o.price),
        wasPrice: o.was_price == null ? null : Number(o.was_price),
        desc: o.description,
        featured: o.featured,
        validatesValet: o.validates_valet,
        hasCode: Boolean(o.staff_code),
        rating: Number(o.rating),
        reviews: Number(o.reviews),
        level: o.level,
        opensAt: fmtTime(o.opens_at),
        closesAt: fmtTime(o.closes_at),
        dealTag: o.deal_tag,
        imageUrl: o.image_url,
        menuUrl: o.menu_url,
      })),
    });
  } catch (err) {
    console.error("[public-tap GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ uid: string }> }) {
  if (!rateLimit(req, { max: 30, windowMs: 60000 })) {
    return NextResponse.json({ error: "Too many requests — try again in a minute" }, { status: 429 });
  }

  const { uid: rawUid } = await params;
  const uid = String(rawUid || "").trim();
  if (!uid) return NextResponse.json({ error: "Card UID is required" }, { status: 400 });

  let body: { minutes?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const minutes = Number(body?.minutes);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 30) {
    return NextResponse.json({ error: "ETA must be between 5 and 30 minutes" }, { status: 400 });
  }

  try {
    const { rows: cards } = await query("SELECT id FROM nfc_cards WHERE uid = $1 OR UPPER(physical_uid) = UPPER($2)", [uid, uid]);
    const card = cards[0] as { id: number } | undefined;
    if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

    const { rows: orders } = await query(
      `SELECT id, status FROM orders
       WHERE card_id = $1 AND status IN ('active','parked','retrieving','returning')
       ORDER BY created_at DESC LIMIT 1`,
      [card.id]
    );
    const order = orders[0] as { id: number; status: string } | undefined;
    if (!order) {
      return NextResponse.json({ error: "No parked car found for this card" }, { status: 400 });
    }
    if (order.status === "returning") {
      return NextResponse.json({ error: "Your car is already on the way" }, { status: 400 });
    }

    await query(`UPDATE orders SET status='returning', guest_eta = now() + make_interval(mins => $1) WHERE id = $2`, [
      minutes,
      order.id,
    ]);

    const { rows: etaRows } = await query("SELECT guest_eta, property_id FROM orders WHERE id = $1", [order.id]);
    const eta = etaRows[0]?.guest_eta as Date | null | undefined;
    const propertyId = etaRows[0]?.property_id as number | undefined;

    broadcast("valet.order.return.requested", {
      propertyId,
      orderId: order.id,
      minutes,
      guestEta: eta,
      status: "returning",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      minutes,
      eta,
    });
  } catch (err) {
    console.error("[public-tap POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}