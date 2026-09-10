import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prismaWithoutTenantScoping } from "../index";

const runId = Date.now().toString(36);

describe("orders: one ACTIVE order per card (#31)", () => {
  let propertyId = 0;
  let cardId = 0;

  beforeAll(async () => {
    const prop = await prismaWithoutTenantScoping.property.create({
      data: { name: `OrdCon Test ${runId}`, area: "Test Area", slug: `ordcon-${runId}`, city: "Dubai" },
    });
    propertyId = prop.id;
    const card = await prismaWithoutTenantScoping.nfcCard.create({
      data: { uid: `ORDCON-${runId}`, physicalUid: `ORDCON-PHY-${runId}`, propertyId, status: "ready" },
    });
    cardId = card.id;
  });

  afterAll(async () => {
    await prismaWithoutTenantScoping.$executeRawUnsafe(
      `DELETE FROM validations WHERE order_id IN (SELECT id FROM orders WHERE property_id = $1)`,
      propertyId
    );
    await prismaWithoutTenantScoping.$executeRawUnsafe(`DELETE FROM orders WHERE property_id = $1`, propertyId);
    await prismaWithoutTenantScoping.$executeRawUnsafe(`DELETE FROM nfc_cards WHERE id = $1`, cardId);
    await prismaWithoutTenantScoping.$executeRawUnsafe(`DELETE FROM properties WHERE id = $1`, propertyId);
  });

  const insertActiveOrder = (plate: string) =>
    prismaWithoutTenantScoping.$executeRawUnsafe(
      `INSERT INTO orders (property_id, card_id, plate, status) VALUES ($1, $2, $3, 'active')`,
      propertyId,
      cardId,
      plate
    );

  const countActive = () =>
    prismaWithoutTenantScoping
      .$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT COUNT(*)::bigint AS n FROM orders WHERE card_id = $1 AND status = 'active'`,
        cardId
      )
      .then((rows) => Number(rows[0]?.n ?? 0n));

  it("allows only one concurrent ACTIVE order insert for the same card", async () => {
    const results = await Promise.allSettled([insertActiveOrder(`PLATE-A-${runId}`), insertActiveOrder(`PLATE-B-${runId}`)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectedResult = rejected[0];
    if (rejectedResult && rejectedResult.status === "rejected") {
      // Raw queries wrap the PG unique-violation (23505) as a P2010 with the
      // underlying code on meta.
      expect((rejectedResult.reason as { meta?: { code?: string } }).meta?.code).toBe("23505");
    }
    expect(await countActive()).toBe(1);
  });

  it("still rejects a third ACTIVE insert while an active order exists", async () => {
    await expect(insertActiveOrder(`PLATE-C-${runId}`)).rejects.toMatchObject({ meta: { code: "23505" } });
    expect(await countActive()).toBe(1);
  });

  it("allows a new ACTIVE order once the card's order is returned", async () => {
    await prismaWithoutTenantScoping.$executeRawUnsafe(
      `UPDATE orders SET status = 'returned', returned_at = NOW() WHERE card_id = $1 AND status = 'active'`,
      cardId
    );
    const inserted = await insertActiveOrder(`PLATE-D-${runId}`);
    expect(inserted).toBeGreaterThan(0);

    const rows = await prismaWithoutTenantScoping.$queryRawUnsafe<{ status: string }[]>(
      `SELECT status FROM orders WHERE card_id = $1 ORDER BY id`,
      cardId
    );
    expect(rows.map((r) => r.status).sort()).toEqual(["active", "returned"]);
    expect(await countActive()).toBe(1);
  });
});