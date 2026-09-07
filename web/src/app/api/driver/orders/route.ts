import { NextResponse } from "next/server";
import { transaction } from "@/app/tenant-admin/_lib/db";
import { requireDriver } from "@/lib/driver-session";
import { broadcast } from "@/lib/valet-live";

interface CardRow {
  id: number;
  uid: string;
  status: string;
}

export async function POST(req: Request) {
  const auth = requireDriver(req);
  if (auth instanceof Response) return auth;
  const { claims } = auth;

  let body: {
    cardUid?: string;
    cardNumber?: string;
    plate?: string;
    carMake?: string;
    carModel?: string;
    carColor?: string;
    zone?: string;
    slot?: string;
    createCard?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const cardUid = body?.cardUid ? String(body.cardUid).trim() : "";
  const cardNumber = body?.cardNumber ? String(body.cardNumber).trim() : "";
  const { plate, carMake, carModel, carColor, zone, slot, createCard } = body || {};

  if (!plate) return NextResponse.json({ error: "plate is required" }, { status: 400 });
  if (!cardUid && !cardNumber) {
    return NextResponse.json({ error: "cardUid or cardNumber is required" }, { status: 400 });
  }
  const propertyId = claims.propertyId;
  if (!propertyId) {
    return NextResponse.json({ error: "No property selected — start shift first" }, { status: 400 });
  }

  try {
    const outcome = await transaction(async (exec) => {
      let card: CardRow | null = null;

      if (cardUid) {
        const byPhysical = await exec(
          "SELECT id, status, uid FROM nfc_cards WHERE physical_uid = $1 AND property_id = $2 FOR UPDATE",
          [cardUid, propertyId]
        );
        card = (byPhysical.rows[0] as CardRow | undefined) || null;
      }

      const printed = cardNumber || (/^\d{1,6}$/.test(cardUid) ? cardUid : null);
      let assignedNumber: string | null = null;

      if (!card && printed) {
        const byUid = await exec("SELECT id, status, uid FROM nfc_cards WHERE uid = $1 AND property_id = $2 FOR UPDATE", [
          printed,
          propertyId,
        ]);
        card = (byUid.rows[0] as CardRow | undefined) || null;
        if (card && cardUid && cardUid !== printed) {
          await exec("UPDATE nfc_cards SET physical_uid = $1 WHERE id = $2", [cardUid, card.id]);
        }
        if (!card && createCard && cardNumber) {
          const globalRows = await exec("SELECT id, property_id FROM nfc_cards WHERE uid = $1", [printed]);
          if (globalRows.rows.length) {
            return {
              code: 400,
              error: `Card #${printed} already exists at another property (${globalRows.rows[0].property_id})`,
            };
          }
          const created = await exec(
            "INSERT INTO nfc_cards (uid, physical_uid, property_id, status) VALUES ($1, $2, $3, 'ready') RETURNING id, status, uid",
            [printed, cardUid || null, propertyId]
          );
          card = created.rows[0] as CardRow;
        }
      }

      if (!card && cardUid && !printed) {
        const maxRows = await exec(
          "SELECT COALESCE(MAX(uid::bigint), 0)::bigint AS max_uid FROM nfc_cards WHERE property_id = $1 AND uid ~ '^[0-9]+$'",
          [propertyId]
        );
        let nextUid = Number(maxRows.rows[0]?.max_uid || 0) + 1;
        for (let i = 0; i < 10; i++) {
          const ex = await exec("SELECT 1 FROM nfc_cards WHERE uid = $1", [String(nextUid)]);
          if (!ex.rows.length) break;
          nextUid += 1;
        }
        const created = await exec(
          "INSERT INTO nfc_cards (uid, physical_uid, property_id, status) VALUES ($1, $2, $3, 'ready') RETURNING id, status, uid",
          [String(nextUid), cardUid, propertyId]
        );
        card = created.rows[0] as CardRow;
        assignedNumber = card.uid;
      }

      if (!card) {
        if (printed) {
          const rows = await exec("SELECT id, property_id, status, uid FROM nfc_cards WHERE uid = $1", [printed]);
          if (rows.rows.length) {
            return {
              code: 400,
              error: `Card #${printed} exists at property ${rows.rows[0].property_id} (status: ${rows.rows[0].status}), but your session property is ${propertyId}`,
            };
          }
        }
        if (cardUid) {
          const rows = await exec("SELECT id, property_id, status, uid FROM nfc_cards WHERE physical_uid = $1", [
            cardUid,
          ]);
          if (rows.rows.length) {
            return {
              code: 400,
              error: `Card serial ${cardUid} exists at property ${rows.rows[0].property_id} (card #${rows.rows[0].uid}, status: ${rows.rows[0].status}), but your session property is ${propertyId}`,
            };
          }
        }
        return { code: 400, error: "Card not found. Enter the 4-digit card number printed on the card." };
      }

      if (card.status === "blocked") return { code: 400, error: "This card is blocked" };
      if (card.status === "with_guest") {
        return { code: 400, error: "This card is already assigned to an active vehicle" };
      }

      const orderRows = await exec(
        `INSERT INTO orders (property_id, card_id, driver_id, plate, car_make, car_model, car_color, zone, slot, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
         RETURNING id, created_at`,
        [propertyId, card.id, claims.driverId, plate, carMake || null, carModel || null, carColor || null, zone || null, slot || null]
      );

      await exec("UPDATE nfc_cards SET status = 'with_guest', uses_count = uses_count + 1 WHERE id = $1", [
        card.id,
      ]);

      return { card, order: orderRows.rows[0], assignedNumber };
    });

    if ("code" in outcome) {
      return NextResponse.json({ error: outcome.error }, { status: outcome.code as number });
    }

    broadcast("nfc.card.activated", {
      propertyId,
      cardUid,
      orderId: outcome.order.id,
      driverId: claims.driverId,
      plate,
      carMake: carMake || null,
      carModel: carModel || null,
      carColor: carColor || null,
      timestamp: new Date().toISOString(),
    });
    broadcast("valet.order.created", {
      propertyId,
      orderId: outcome.order.id,
      cardUid,
      driverId: claims.driverId,
      plate,
      status: "active",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        orderId: outcome.order.id,
        createdAt: outcome.order.created_at,
        ...(outcome.assignedNumber ? { cardNumber: outcome.assignedNumber } : {}),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[driver-orders POST]", err);
    // Partial unique index orders_one_active_per_card (see #31): a racing
    // duplicate check-in trips the unique violation before the card update.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "This card is already assigned to an active vehicle" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}